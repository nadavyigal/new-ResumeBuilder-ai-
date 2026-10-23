import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { createPrivateKey, sign, X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A structurally valid certificate chain (root -> intermediate -> leaf, with
// Apple's two marker extensions) built at test time with the openssl CLI.
// 1. Against the real bundled Apple root it must fail: right shape, wrong root.
// 2. With that test root swapped in (online checks off, nothing else mocked),
//    our wiring must accept a correct transaction and reject a wrong bundle or
//    an environment claim that the signature does not back.

type Chain = { rootPem: string; x5c: string[]; leafKeyPem: string };

let dir: string;
let chain: Chain;

function openssl(args: string[]) {
  execFileSync('openssl', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
}

function buildChain(): Chain {
  dir = mkdtempSync(join(tmpdir(), 'iap-chain-'));
  writeFileSync(join(dir, 'ext.cnf'), [
    '[root]', 'basicConstraints=critical,CA:TRUE', 'keyUsage=critical,keyCertSign,cRLSign',
    '[intermediate]', 'basicConstraints=critical,CA:TRUE,pathlen:0', 'keyUsage=critical,keyCertSign,cRLSign',
    '1.2.840.113635.100.6.2.1=ASN1:NULL',
    '[leaf]', 'basicConstraints=critical,CA:FALSE', 'keyUsage=critical,digitalSignature',
    '1.2.840.113635.100.6.11.1=ASN1:NULL',
    '[req]', 'distinguished_name=dn', '[dn]',
  ].join('\n'));
  for (const name of ['root', 'intermediate', 'leaf']) {
    openssl(['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', `${name}.key`]);
  }
  openssl(['req', '-new', '-x509', '-key', 'root.key', '-subj', '/CN=Not Apple Test Root', '-days', '30',
    '-config', 'ext.cnf', '-extensions', 'root', '-out', 'root.pem']);
  for (const [name, issuer] of [['intermediate', 'root'], ['leaf', 'intermediate']]) {
    openssl(['req', '-new', '-key', `${name}.key`, '-subj', `/CN=Not Apple Test ${name}`, '-config', 'ext.cnf', '-out', `${name}.csr`]);
    openssl(['x509', '-req', '-in', `${name}.csr`, '-CA', `${issuer}.pem`, '-CAkey', `${issuer}.key`, '-CAcreateserial',
      '-days', '30', '-extfile', 'ext.cnf', '-extensions', name, '-out', `${name}.pem`]);
  }
  const der = (name: string) => new X509Certificate(readFileSync(join(dir, `${name}.pem`))).raw.toString('base64');
  return {
    rootPem: readFileSync(join(dir, 'root.pem'), 'utf8'),
    x5c: [der('leaf'), der('intermediate'), der('root')],
    leafKeyPem: readFileSync(join(dir, 'leaf.key'), 'utf8'),
  };
}

function signedJws(payload: Record<string, unknown>) {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = b64({ alg: 'ES256', x5c: chain.x5c });
  const body = b64(payload);
  const signature = sign('sha256', Buffer.from(`${header}.${body}`), {
    key: createPrivateKey(chain.leafKeyPem),
    dsaEncoding: 'ieee-p1363',
  });
  return `${header}.${body}.${signature.toString('base64url')}`;
}

const BUNDLE = 'Resumebuilder-IOS.ResumeBuilder-IOS-APP';
const config = { bundleId: BUNDLE, appAppleId: 6740000000, allowedEnvironments: ['Production', 'Sandbox'] as const };
const transaction = {
  transactionId: '2000000000000001',
  originalTransactionId: '2000000000000001',
  productId: 'resumely.exports.5',
  bundleId: BUNDLE,
  type: 'Consumable',
  quantity: 1,
  environment: 'Sandbox',
  appAccountToken: '11111111-1111-4111-8111-111111111111',
  signedDate: Date.now(),
  purchaseDate: Date.now(),
};

beforeAll(() => {
  chain = buildChain();
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('a valid-looking chain from a foreign root', () => {
  it('is rejected by the bundled Apple root', async () => {
    jest.resetModules();
    const { verifySignedTransaction } = jest.requireActual('@/lib/iap') as typeof import('@/lib/iap');
    await expect(
      verifySignedTransaction(signedJws(transaction), { ...config, allowedEnvironments: ['Production', 'Sandbox'] })
    ).resolves.toEqual({ ok: false, reason: 'invalid_transaction' });
  });
});

describe('the verifier wiring, with the test root trusted', () => {
  let verifySignedTransaction: typeof import('@/lib/iap').verifySignedTransaction;

  beforeAll(() => {
    jest.resetModules();
    jest.doMock('@/lib/apple-root-certificates', () => ({ __esModule: true, APPLE_ROOT_CA_G3_PEM: chain.rootPem }));
    jest.doMock('@apple/app-store-server-library', () => {
      const actual = jest.requireActual('@apple/app-store-server-library') as typeof import('@apple/app-store-server-library');
      // Online checks need Apple's OCSP responder; the test root has none.
      class OfflineVerifier extends actual.SignedDataVerifier {
        constructor(roots: Buffer[], _online: boolean, environment: any, bundleId: string, appAppleId?: number) {
          super(roots, false, environment, bundleId, appAppleId);
        }
      }
      return { ...actual, SignedDataVerifier: OfflineVerifier };
    });
    ({ verifySignedTransaction } = require('@/lib/iap'));
  });

  it('accepts a correctly signed Sandbox transaction and returns its fields', async () => {
    const result = await verifySignedTransaction(signedJws(transaction), { ...config, allowedEnvironments: ['Production', 'Sandbox'] });
    expect(result).toEqual(expect.objectContaining({ ok: true, environment: 'Sandbox' }));
    if (result.ok) {
      expect(result.value.productId).toBe('resumely.exports.5');
      expect(result.value.appAccountToken).toBe(transaction.appAccountToken);
    }
  });

  it('accepts a correctly signed Production transaction', async () => {
    const result = await verifySignedTransaction(
      signedJws({ ...transaction, environment: 'Production' }),
      { ...config, allowedEnvironments: ['Production', 'Sandbox'] }
    );
    expect(result).toEqual(expect.objectContaining({ ok: true, environment: 'Production' }));
  });

  it('rejects another app\'s bundle ID', async () => {
    await expect(
      verifySignedTransaction(signedJws({ ...transaction, bundleId: 'com.other.app' }), {
        ...config,
        allowedEnvironments: ['Production', 'Sandbox'],
      })
    ).resolves.toEqual({ ok: false, reason: 'invalid_transaction' });
  });

  it('rejects a tampered payload (signature no longer matches)', async () => {
    const [header, , sig] = signedJws(transaction).split('.');
    const forgedBody = Buffer.from(JSON.stringify({ ...transaction, productId: 'resumely.exports.10' })).toString('base64url');
    await expect(
      verifySignedTransaction(`${header}.${forgedBody}.${sig}`, { ...config, allowedEnvironments: ['Production', 'Sandbox'] })
    ).resolves.toEqual({ ok: false, reason: 'invalid_transaction' });
  });

  it('only allows the environments in the config', async () => {
    await expect(
      verifySignedTransaction(signedJws({ ...transaction, environment: 'Production' }), {
        ...config,
        allowedEnvironments: ['Sandbox'],
      })
    ).resolves.toEqual({ ok: false, reason: 'environment_not_allowed' });
  });
});

import SwiftUI
import AuthenticationServices

struct OnboardingView: View {
    @Bindable var viewModel: OnboardingViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Hero
                    VStack(spacing: 8) {
                        Image(systemName: "doc.text.magnifyingglass")
                            .font(.system(size: 56))
                            .foregroundStyle(.primary)
                        Text("Resumely")
                            .font(.largeTitle.bold())
                        Text("Tailor your resume to any job in 60 seconds.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 40)

                    // Sign in with Apple — always visible, no toggle needed
                    SignInWithAppleButton(
                        viewModel.isSignUp ? .signUp : .signIn,
                        onRequest: { request in
                            request.requestedScopes = [.fullName, .email]
                        },
                        onCompletion: { _ in
                            // Handled by the ViewModel via its own coordinator call.
                            // The button's completion is intentionally ignored here;
                            // tapping the button triggers viewModel.signInWithApple().
                        }
                    )
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 50)
                    .onTapGesture {
                        Task { await viewModel.signInWithApple() }
                    }
                    .padding(.horizontal)

                    // Divider
                    HStack {
                        Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                        Text("or").font(.footnote).foregroundStyle(.secondary)
                        Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                    }
                    .padding(.horizontal)

                    // Email form
                    VStack(spacing: 12) {
                        TextField("Email", text: $viewModel.email)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .padding()
                            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))

                        SecureField("Password", text: $viewModel.password)
                            .textContentType(viewModel.isSignUp ? .newPassword : .password)
                            .padding()
                            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))

                        Button {
                            Task {
                                if viewModel.isSignUp {
                                    await viewModel.signUp()
                                } else {
                                    await viewModel.signInWithEmail()
                                }
                            }
                        } label: {
                            Group {
                                if viewModel.isLoading {
                                    ProgressView()
                                } else {
                                    Text(viewModel.isSignUp ? "Create Account" : "Sign In")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(viewModel.isLoading)
                    }
                    .padding(.horizontal)

                    // Toggle sign-in / sign-up
                    Button {
                        withAnimation { viewModel.isSignUp.toggle() }
                    } label: {
                        HStack(spacing: 4) {
                            Text(viewModel.isSignUp ? "Already have an account?" : "Don't have an account?")
                                .foregroundStyle(.secondary)
                            Text(viewModel.isSignUp ? "Sign In" : "Sign Up")
                                .fontWeight(.semibold)
                        }
                        .font(.footnote)
                    }

                    // Error
                    if let errorMessage = viewModel.errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .padding(.horizontal)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.bottom, 40)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

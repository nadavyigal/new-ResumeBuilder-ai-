"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  Calendar,
  ExternalLink,
  FileText,
  Plus,
  TrendingUp,
} from "lucide-react";

interface Application {
  id: string;
  job_title: string;
  company_name: string;
  job_url: string | null;
  status: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected' | 'withdrawn';
  applied_date: string | null;
  notes: string | null;
  created_at: string;
  optimizations: {
    id: string;
    match_score: number;
    job_descriptions: {
      title: string;
      company: string;
    };
  };
}

/**
 * Applications Dashboard Component
 * Epic 6: FR-026 - Display all saved job applications
 *
 * Shows list of applications with status and linked resume data
 */
export function ApplicationsDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const router = useRouter();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await fetch("/api/applications");
      const data = await response.json();

      if (response.ok) {
        setApplications(data.applications || []);
      } else {
        console.error("Failed to fetch applications:", data.error);
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Application['status']) => {
    const colors = {
      saved: "bg-gray-500",
      applied: "bg-blue-500",
      interviewing: "bg-yellow-500",
      offered: "bg-green-500",
      rejected: "bg-red-500",
      withdrawn: "bg-gray-400",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusLabel = (status: Application['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const filteredApplications = filter === "all"
    ? applications
    : applications.filter(app => app.status === filter);

  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'applied').length,
    interviewing: applications.filter(a => a.status === 'interviewing').length,
    offered: applications.filter(a => a.status === 'offered').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Job Applications</h1>
          <p className="text-muted-foreground mt-1">
            Track your job applications and their status
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Applications</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Applied</CardDescription>
            <CardTitle className="text-3xl">{stats.applied}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Interviewing</CardDescription>
            <CardTitle className="text-3xl">{stats.interviewing}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Offers</CardDescription>
            <CardTitle className="text-3xl">{stats.offered}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Filter by status:</label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="saved">Saved</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="interviewing">Interviewing</SelectItem>
            <SelectItem value="offered">Offered</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredApplications.length} application{filteredApplications.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {filter === "all" ? "No applications yet" : `No ${filter} applications`}
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              {filter === "all"
                ? "Start tracking your job applications by saving them after optimization"
                : `No applications with status "${filter}"`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredApplications.map((application) => (
            <Card
              key={application.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboard/applications/${application.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{application.job_title}</h3>
                      <Badge className={getStatusColor(application.status)}>
                        {getStatusLabel(application.status)}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      {application.company_name}
                    </p>

                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>Match Score: {application.optimizations.match_score}%</span>
                      </div>

                      {application.applied_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Applied: {new Date(application.applied_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>
                          Saved: {new Date(application.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {application.notes && (
                      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                        {application.notes}
                      </p>
                    )}
                  </div>

                  {application.job_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a
                        href={application.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Job
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

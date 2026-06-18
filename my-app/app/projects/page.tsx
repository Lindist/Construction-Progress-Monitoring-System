"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { listProjects, createProject, updateProject, deleteProject, Project } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash, Edit, RefreshCw } from "lucide-react";

export default function ProjectsPage() {
  const router = useRouter();
  const { isAuthenticated, token, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Wait for store initialization
    if (!token && !localStorage.getItem("token")) {
      router.push("/login");
    }
  }, [token, router]);

  // Query projects
  const { data: projects = [], isLoading, error, refetch } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: !!token,
  });

  // Create Project mutation
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsNewProjectModalOpen(false);
      setName("");
      setDescription("");
    },
    onError: (err: any) => {
      setErrorMessage(err.message || "Failed to create project");
    },
  });

  // Update Project mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, params }: { id: string; params: { name: string; description: string } }) =>
      updateProject(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingProject(null);
      setName("");
      setDescription("");
    },
    onError: (err: any) => {
      setErrorMessage(err.message || "Failed to update project");
    },
  });

  // Delete Project mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: any) => {
      alert(err.message || "Failed to delete project");
    },
  });

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setName("");
    setDescription("");
    setErrorMessage(null);
    setIsNewProjectModalOpen(true);
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description);
    setErrorMessage(null);
    setIsNewProjectModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (editingProject) {
      updateMutation.mutate({
        id: editingProject.id,
        params: { name, description },
      });
    } else {
      createMutation.mutate({ name, description });
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (!isAuthenticated && !token) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted">Loading auth state...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Construction Projects
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage your site monitors, uploads, and AI progress evaluations.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90 cursor-pointer"
        >
          <Plus size={18} />
          Create New Project
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="animate-spin text-muted" size={32} />
        </div>
      ) : error ? (
        <div className="mt-8 rounded-lg border border-danger/20 bg-danger/10 p-6 text-center text-danger">
          <p className="font-semibold">Error loading projects</p>
          <p className="mt-1 text-sm text-muted">{(error as any).message || "Something went wrong"}</p>
          <button onClick={() => refetch()} className="mt-4 rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            Try Again
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-border bg-panel p-12 text-center">
          <p className="text-lg font-medium text-foreground">No projects found</p>
          <p className="mt-2 text-sm text-muted">Get started by creating your first construction project.</p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/95 cursor-pointer"
          >
            <Plus size={16} />
            Create Project
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="group flex flex-col justify-between rounded-xl border border-border bg-panel p-6 shadow-sm hover:shadow-md transition">
              <div>
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition">
                  {project.name}
                </h3>
                <p className="mt-2 text-sm text-muted line-clamp-3 leading-relaxed">
                  {project.description || "No description provided."}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                <button
                  onClick={() => router.push(`/upload?projectId=${project.id}`)}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Upload & Workspace →
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(project)}
                    className="rounded p-1.5 text-muted hover:bg-panel-strong hover:text-foreground cursor-pointer"
                    title="Edit project"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.name)}
                    className="rounded p-1.5 text-muted hover:bg-danger/10 hover:text-danger cursor-pointer"
                    title="Delete project"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-foreground">
              {editingProject ? "Edit Project" : "Create New Project"}
            </h2>
            <p className="mt-1 text-xs text-muted">
              Add details for the site location or monitoring project.
            </p>

            {errorMessage && (
              <div className="mt-4 rounded bg-danger/10 p-2 text-xs text-danger">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground">Project Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  placeholder="e.g. Bangkok Central Tower"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none"
                  placeholder="e.g. Phase 2 structural expansion and worker safety compliance audits"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="rounded-md border border-border bg-transparent px-4 py-2 text-sm font-semibold text-muted hover:bg-panel-strong cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/95 disabled:opacity-50 cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

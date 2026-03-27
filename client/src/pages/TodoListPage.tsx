import { useState, useEffect, useCallback, type FormEvent } from "react";
import { todoApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ListChecks,
  Trash2,
  RotateCcw,
} from "lucide-react";

interface Todo {
  id: string;
  title: string;
  dueDate: string;
  status: "OPEN" | "COMPLETED";
  completedAt: string | null;
  createdAt: string;
}

interface Stats {
  open: number;
  completed: number;
  overdue: number;
  dueToday: number;
}

type Period = "all" | "today" | "this_week" | "overdue" | "archived";

export default function TodoListPage() {
  const toast = useToast();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<Stats>({ open: 0, completed: 0, overdue: 0, dueToday: 0 });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("all");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (period !== "all") params.period = period;
      const res = await todoApi.list(params);
      setTodos(res.data.data.data);
    } catch {
      toast.error("Failed to load todos");
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchStats = async () => {
    try {
      const res = await todoApi.getStats();
      setStats(res.data.data);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      toast.error("Please enter a title and due date");
      return;
    }
    setAdding(true);
    try {
      await todoApi.create(title.trim(), dueDate);
      setTitle("");
      setDueDate("");
      fetchTodos();
      fetchStats();
      toast.success("Task added");
    } catch {
      toast.error("Failed to add task");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (todo: Todo) => {
    try {
      if (todo.status === "OPEN") {
        await todoApi.complete(todo.id);
      } else {
        await todoApi.reopen(todo.id);
      }
      fetchTodos();
      fetchStats();
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await todoApi.remove(id);
      fetchTodos();
      fetchStats();
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const isOverdue = (todo: Todo) => {
    if (todo.status === "COMPLETED") return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(todo.dueDate) < today;
  };

  const isToday = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(dateStr)) return "Today";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear()
    )
      return "Tomorrow";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const tabs: { key: Period; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.open },
    { key: "today", label: "Today", count: stats.dueToday },
    { key: "this_week", label: "This Week" },
    { key: "overdue", label: "Overdue", count: stats.overdue },
    { key: "archived", label: "Archived", count: stats.completed },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">To-Do List</h1>
        <p className="mt-1 text-[13px] text-gray-500">
          Track your tasks and stay organized.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <ListChecks className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-[13px] text-gray-500">Open Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.open}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <CheckCircle2 className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-[13px] text-gray-500">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.completed}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2">
              <AlertTriangle className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-[13px] text-gray-500">Overdue</p>
              <p className="text-2xl font-semibold text-red-600">
                {stats.overdue}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add */}
      <form
        onSubmit={handleAdd}
        className="mb-6 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
            Task
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            placeholder="What needs to be done?"
          />
        </div>
        <div className="sm:w-44">
          <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
            Due Date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus size={16} />
          Add
        </button>
      </form>

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100/80 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPeriod(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-200 ${
              period === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                  period === tab.key
                    ? tab.key === "overdue"
                      ? "bg-red-50 text-red-600"
                      : "bg-gray-100 text-gray-600"
                    : "bg-gray-200/80 text-gray-500"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Todo List */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" />
          </div>
        ) : todos.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <ListChecks size={48} className="mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">
              {period === "archived" ? "No completed tasks yet" : "No tasks found"}
            </p>
            <p className="mt-1 text-[13px] text-gray-400">
              {period === "archived"
                ? "Completed tasks will appear here"
                : "Add a task above to get started"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100/80">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className={`group flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-gray-50/80 ${
                  isOverdue(todo) ? "bg-red-50/30" : ""
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(todo)}
                  className="flex-shrink-0"
                >
                  {todo.status === "COMPLETED" ? (
                    <CheckCircle2
                      size={20}
                      className="text-green-500 transition-colors duration-200"
                    />
                  ) : (
                    <Circle
                      size={20}
                      className="text-gray-300 transition-colors duration-200 hover:text-primary-500"
                    />
                  )}
                </button>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      todo.status === "COMPLETED"
                        ? "text-gray-400 line-through"
                        : "text-gray-900"
                    }`}
                  >
                    {todo.title}
                  </p>
                  {todo.status === "COMPLETED" && todo.completedAt && (
                    <p className="text-[11px] text-gray-400">
                      Completed {new Date(todo.completedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Due date badge */}
                <span
                  className={`flex-shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                    todo.status === "COMPLETED"
                      ? "bg-gray-50 text-gray-400"
                      : isOverdue(todo)
                        ? "bg-red-50 text-red-600"
                        : isToday(todo.dueDate)
                          ? "bg-primary-50 text-primary-600"
                          : "bg-gray-50 text-gray-600"
                  }`}
                >
                  <Clock size={12} className="mr-1 inline-block" />
                  {formatDate(todo.dueDate)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {todo.status === "COMPLETED" && (
                    <button
                      onClick={() => handleToggle(todo)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title="Reopen"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

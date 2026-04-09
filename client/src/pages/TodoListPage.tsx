import { useState, useEffect, useCallback, type FormEvent } from "react";
import { todoApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls } from "../lib/styles";
import { EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ListChecks,
  Trash2,
  RotateCcw,
  Pencil,
  Check,
  X,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditDueDate(todo.dueDate.slice(0, 10));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDueDate("");
  };

  const handleEdit = async (id: string) => {
    if (!editTitle.trim()) { toast.error("Title cannot be empty"); return; }
    try {
      await todoApi.update(id, { title: editTitle.trim(), dueDate: editDueDate });
      cancelEdit();
      fetchTodos();
      toast.success("Task updated");
    } catch {
      toast.error("Failed to update task");
    }
  };

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

  useEffect(() => { fetchTodos(); }, [fetchTodos]);
  useEffect(() => { fetchStats(); }, []);

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
      if (todo.status === "OPEN") await todoApi.complete(todo.id);
      else await todoApi.reopen(todo.id);
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
    const d = new Date(dateStr), t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(dateStr)) return "Today";
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    if (date.getDate() === tm.getDate() && date.getMonth() === tm.getMonth() && date.getFullYear() === tm.getFullYear())
      return "Tomorrow";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      <PageHeader title="To-Do List" subtitle="Track your tasks and stay organized." />

      {/* Stats */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([
          { icon: <ListChecks size={18} className="text-blue-600" />, bg: "bg-blue-50", label: "Open Tasks", value: stats.open, color: "text-gray-900" },
          { icon: <CheckCircle2 size={18} className="text-green-600" />, bg: "bg-green-50", label: "Completed", value: stats.completed, color: "text-gray-900" },
          { icon: <AlertTriangle size={18} className="text-red-600" />, bg: "bg-red-50", label: "Overdue", value: stats.overdue, color: "text-red-600" },
        ] as const).map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-lg bg-white p-3.5 ring-1 ring-gray-200">
            <div className={`rounded-md p-2 ${s.bg}`}>{s.icon}</div>
            <div>
              <p className="text-[12px] text-gray-500">{s.label}</p>
              <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Add */}
      <form
        onSubmit={handleAdd}
        className="mb-3 flex flex-col gap-3 rounded-lg bg-white p-3 ring-1 ring-gray-200 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className={cls.label}>Task</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cls.input}
            placeholder="What needs to be done?"
          />
        </div>
        <div className="sm:w-44">
          <label className={cls.label}>Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={cls.input}
          />
        </div>
        <button type="submit" disabled={adding} className={cls.btnPrimary}>
          <Plus size={14} />
          Add
        </button>
      </form>

      {/* Filter Tabs */}
      <div className="mb-3 flex gap-1 rounded-lg bg-gray-100/80 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPeriod(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors ${
              period === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[11px] font-medium ${
                period === tab.key
                  ? tab.key === "overdue" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"
                  : "bg-gray-200/80 text-gray-500"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Todo List */}
      <div className="rounded-lg bg-white ring-1 ring-gray-200">
        {loading ? (
          <TableLoading />
        ) : todos.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={40} />}
            title={period === "archived" ? "No completed tasks yet" : "No tasks found"}
            subtitle={period === "archived" ? "Completed tasks will appear here" : "Add a task above to get started"}
          />
        ) : (
          <ul className="divide-y divide-gray-100/80">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className={`group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50/80 ${
                  isOverdue(todo) ? "bg-red-50/30" : ""
                }`}
              >
                <button onClick={() => handleToggle(todo)} className="flex-shrink-0">
                  {todo.status === "COMPLETED" ? (
                    <CheckCircle2 size={16} className="text-green-500" />
                  ) : (
                    <Circle size={16} className="text-gray-300 hover:text-primary-500 transition-colors" />
                  )}
                </button>

                {editingId === todo.id ? (
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleEdit(todo.id); if (e.key === "Escape") cancelEdit(); }}
                      className={`min-w-0 flex-1 ${cls.input} text-sm`}
                      autoFocus
                    />
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className={`w-36 ${cls.input} text-sm`}
                    />
                    <button onClick={() => handleEdit(todo.id)} className="rounded-md p-1 text-green-600 hover:bg-green-50" title="Save">
                      <Check size={14} />
                    </button>
                    <button onClick={cancelEdit} className="rounded-md p-1 text-gray-400 hover:bg-gray-100" title="Cancel">
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${todo.status === "COMPLETED" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                        {todo.title}
                      </p>
                      {todo.status === "COMPLETED" && todo.completedAt && (
                        <p className="text-[11px] text-gray-400">
                          Completed {new Date(todo.completedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <span className={`flex-shrink-0 rounded-md px-1.5 py-px text-[11px] font-medium ${
                      todo.status === "COMPLETED"
                        ? "bg-gray-50 text-gray-400"
                        : isOverdue(todo)
                          ? "bg-red-50 text-red-600"
                          : isToday(todo.dueDate)
                            ? "bg-primary-50 text-primary-600"
                            : "bg-gray-50 text-gray-600"
                    }`}>
                      <Clock size={10} className="mr-1 inline-block" />
                      {formatDate(todo.dueDate)}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {todo.status === "OPEN" && (
                        <button
                          onClick={() => startEdit(todo)}
                          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {todo.status === "COMPLETED" && (
                        <button
                          onClick={() => handleToggle(todo)}
                          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Reopen"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(todo.id)}
                        className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

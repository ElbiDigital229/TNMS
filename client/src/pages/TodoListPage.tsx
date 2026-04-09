import { useState, useEffect, useCallback, type FormEvent } from "react";
import { todoApi, userApi } from "../lib/api";
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
  Eye,
  UserPlus,
  Users,
  ChevronDown,
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

interface WatchedList {
  id: string;
  owner: { id: string; fullName: string; username: string };
}

interface Watcher {
  id: string;
  watcher: { id: string; fullName: string; username: string };
}

interface UserOption {
  id: string;
  fullName: string;
  username: string;
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

  // Watcher state
  const [viewingUserId, setViewingUserId] = useState<string | null>(null); // null = my own list
  const [viewingUserName, setViewingUserName] = useState("");
  const [watchedLists, setWatchedLists] = useState<WatchedList[]>([]);
  const [myWatchers, setMyWatchers] = useState<Watcher[]>([]);
  const [showWatcherModal, setShowWatcherModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [addingWatcher, setAddingWatcher] = useState(false);

  const isWatchedView = viewingUserId !== null;

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
      if (viewingUserId) params.userId = viewingUserId;
      const res = await todoApi.list(params);
      setTodos(res.data.data.data);
    } catch {
      toast.error("Failed to load todos");
    } finally {
      setLoading(false);
    }
  }, [period, viewingUserId]);

  const fetchStats = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (viewingUserId) params.userId = viewingUserId;
      const res = await todoApi.getStats(params);
      setStats(res.data.data);
    } catch {
      // silently fail
    }
  }, [viewingUserId]);

  const fetchWatchedLists = async () => {
    try {
      const res = await todoApi.getWatching();
      setWatchedLists(res.data.data);
    } catch {
      // silently fail
    }
  };

  const fetchMyWatchers = async () => {
    try {
      const res = await todoApi.getWatchers();
      setMyWatchers(res.data.data);
    } catch {
      // silently fail
    }
  };

  useEffect(() => { fetchTodos(); }, [fetchTodos]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchWatchedLists(); fetchMyWatchers(); }, []);

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

  const handleAddWatcher = async (userId: string) => {
    setAddingWatcher(true);
    try {
      await todoApi.addWatcher(userId);
      fetchMyWatchers();
      toast.success("Watcher added");
      setShowWatcherModal(false);
      setUserSearch("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add watcher");
    } finally {
      setAddingWatcher(false);
    }
  };

  const handleRemoveWatcher = async (watcherId: string) => {
    try {
      await todoApi.removeWatcher(watcherId);
      fetchMyWatchers();
      toast.success("Watcher removed");
    } catch {
      toast.error("Failed to remove watcher");
    }
  };

  const loadUsers = async (search: string) => {
    try {
      const res = await userApi.list({ search, limit: 20, status: "ACTIVE" });
      setUsers(res.data.data.data || res.data.data);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    if (showWatcherModal && userSearch.length >= 2) {
      const t = setTimeout(() => loadUsers(userSearch), 300);
      return () => clearTimeout(t);
    }
    if (userSearch.length < 2) setUsers([]);
  }, [userSearch, showWatcherModal]);

  const switchToMyList = () => {
    setViewingUserId(null);
    setViewingUserName("");
    setShowViewDropdown(false);
  };

  const switchToWatchedList = (userId: string, name: string) => {
    setViewingUserId(userId);
    setViewingUserName(name);
    setPeriod("all");
    setShowViewDropdown(false);
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

  const watcherIds = new Set(myWatchers.map((w) => w.watcher.id));

  return (
    <div>
      <PageHeader
        title="To-Do List"
        subtitle={isWatchedView ? `Viewing ${viewingUserName}'s tasks` : "Track your tasks and stay organized."}
      />

      {/* View Switcher + Watcher Actions */}
      <div className="mb-3 flex items-center gap-2">
        {/* View switcher dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowViewDropdown((p) => !p)}
            className={`${cls.btnSecondary} min-w-[160px] justify-between`}
          >
            <span className="flex items-center gap-1.5">
              {isWatchedView ? <Eye size={13} /> : <ListChecks size={13} />}
              {isWatchedView ? viewingUserName : "My Tasks"}
            </span>
            <ChevronDown size={13} />
          </button>

          {showViewDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowViewDropdown(false)} />
              <div className="absolute left-0 z-20 mt-1 w-56 rounded-lg bg-white py-1 shadow-lg ring-1 ring-gray-200">
                <button
                  onClick={switchToMyList}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-gray-50 ${
                    !isWatchedView ? "bg-primary-50 text-primary-700 font-medium" : "text-gray-700"
                  }`}
                >
                  <ListChecks size={14} />
                  My Tasks
                </button>
                {watchedLists.length > 0 && (
                  <>
                    <div className="mx-3 my-1 border-t border-gray-100" />
                    <p className="px-3 py-1 text-[11px] font-medium uppercase text-gray-400">Watched Lists</p>
                    {watchedLists.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => switchToWatchedList(w.owner.id, w.owner.fullName || w.owner.username)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-gray-50 ${
                          viewingUserId === w.owner.id ? "bg-primary-50 text-primary-700 font-medium" : "text-gray-700"
                        }`}
                      >
                        <Eye size={14} />
                        {w.owner.fullName || w.owner.username}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* Manage watchers button (only on my list) */}
        {!isWatchedView && (
          <>
            <button onClick={() => setShowManageModal(true)} className={cls.btnSecondary}>
              <Users size={13} />
              Watchers{myWatchers.length > 0 && ` (${myWatchers.length})`}
            </button>
            <button onClick={() => { setShowWatcherModal(true); setUserSearch(""); setUsers([]); }} className={cls.btnSecondary}>
              <UserPlus size={13} />
              Add Watcher
            </button>
          </>
        )}
      </div>

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

      {/* Quick Add (only on my list) */}
      {!isWatchedView && (
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
      )}

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
            subtitle={period === "archived" ? "Completed tasks will appear here" : isWatchedView ? "This user has no tasks" : "Add a task above to get started"}
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
                {/* Toggle button (only for own list) */}
                {!isWatchedView ? (
                  <button onClick={() => handleToggle(todo)} className="flex-shrink-0">
                    {todo.status === "COMPLETED" ? (
                      <CheckCircle2 size={16} className="text-green-500" />
                    ) : (
                      <Circle size={16} className="text-gray-300 hover:text-primary-500 transition-colors" />
                    )}
                  </button>
                ) : (
                  <span className="flex-shrink-0">
                    {todo.status === "COMPLETED" ? (
                      <CheckCircle2 size={16} className="text-green-500" />
                    ) : (
                      <Circle size={16} className="text-gray-300" />
                    )}
                  </span>
                )}

                {!isWatchedView && editingId === todo.id ? (
                  <>
                    <div className="min-w-0 flex-1 space-y-1">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleEdit(todo.id); if (e.key === "Escape") cancelEdit(); }}
                        className={`w-full ${cls.input} text-sm`}
                        autoFocus
                      />
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className={`w-auto ${cls.input} text-[12px]`}
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => handleEdit(todo.id)} className="rounded-md p-1 text-green-600 hover:bg-green-50" title="Save">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelEdit} className="rounded-md p-1 text-gray-400 hover:bg-gray-100" title="Cancel">
                        <X size={14} />
                      </button>
                    </div>
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

                    {/* Actions (only for own list) */}
                    {!isWatchedView && (
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
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Watcher Modal */}
      {showWatcherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowWatcherModal(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Add Watcher</h3>
            <p className="mb-3 text-[12px] text-gray-500">
              Search for a user to give them view access to your to-do list.
            </p>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className={cls.input}
              placeholder="Search by name or username..."
              autoFocus
            />
            {users.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200">
                {users
                  .filter((u) => !watcherIds.has(u.id))
                  .map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => handleAddWatcher(u.id)}
                        disabled={addingWatcher}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-gray-50 disabled:opacity-50"
                      >
                        <UserPlus size={13} className="text-gray-400" />
                        <span className="font-medium text-gray-800">{u.fullName || u.username}</span>
                        {u.fullName && <span className="text-gray-400">@{u.username}</span>}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            {userSearch.length >= 2 && users.filter((u) => !watcherIds.has(u.id)).length === 0 && (
              <p className="mt-2 text-center text-[12px] text-gray-400">No users found</p>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowWatcherModal(false)} className={cls.btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Watchers Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowManageModal(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Manage Watchers</h3>
            <p className="mb-3 text-[12px] text-gray-500">
              These users can view your to-do list.
            </p>
            {myWatchers.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-gray-400">No watchers yet</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                {myWatchers.map((w) => (
                  <li key={w.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <p className="text-[13px] font-medium text-gray-800">
                        {w.watcher.fullName || w.watcher.username}
                      </p>
                      {w.watcher.fullName && (
                        <p className="text-[11px] text-gray-400">@{w.watcher.username}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveWatcher(w.watcher.id)}
                      className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove watcher"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowManageModal(false)} className={cls.btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

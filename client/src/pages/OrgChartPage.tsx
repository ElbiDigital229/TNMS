import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { userApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import { TableLoading } from "../components/ui/DataTable";
import { cls } from "../lib/styles";
import { Search, ZoomIn, ZoomOut, Maximize, Users } from "lucide-react";

interface UserData {
  id: string;
  username: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string;
  role: { id: string; name: string; level: number } | null;
  reportsTo: { id: string; username: string; fullName?: string } | null;
  department?: { id: string; name: string } | null;
  allProperties: boolean;
  isSuperAdmin: boolean;
  _count?: { propertyAssignments: number; subordinates: number };
  status: string;
}

const ROLE_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" }, // SuperAdmin – amber
  1: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" }, // CEO – blue
  2: { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3" }, // OPS Lead – indigo
  3: { bg: "#ede9fe", border: "#8b5cf6", text: "#5b21b6" }, // Community Executive – violet
  4: { bg: "#dcfce7", border: "#22c55e", text: "#166534" }, // Manager – green
  5: { bg: "#fef9c3", border: "#eab308", text: "#854d0e" }, // Supervisor – yellow
  6: { bg: "#f1f5f9", border: "#94a3b8", text: "#334155" }, // Technician – slate
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 90;

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = "TB") {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 80 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function UserNode({ data }: { data: UserData & { subordinateCount: number } }) {
  const level = data.isSuperAdmin ? 0 : (data.role?.level ?? 6);
  const colors = ROLE_COLORS[level] || ROLE_COLORS[6];
  const isInactive = data.status !== "ACTIVE";

  return (
    <div
      className={`rounded-lg border-2 shadow-sm px-3 py-2 min-w-[200px] max-w-[220px] ${isInactive ? "opacity-50" : ""}`}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="font-semibold text-[13px] leading-tight truncate" style={{ color: colors.text }}>
          {data.fullName || data.username}
        </div>
        {data.subordinateCount > 0 && (
          <span
            className="flex-shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: colors.border + "22", color: colors.text }}
          >
            <Users size={9} />
            {data.subordinateCount}
          </span>
        )}
      </div>
      <div className="text-[11px] font-medium mt-0.5" style={{ color: colors.text + "cc" }}>
        {data.role?.name || "No Role"}
      </div>
      {data.department?.name && (
        <div className="text-[10px] mt-0.5 text-gray-500 truncate">
          {data.department.name}
        </div>
      )}
      {data.employeeCode && (
        <div className="text-[10px] mt-0.5 font-mono text-gray-400">
          {data.employeeCode}
        </div>
      )}
      {isInactive && (
        <div className="text-[9px] mt-0.5 font-semibold text-red-500 uppercase">
          {data.status}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { userNode: UserNode };

export default function OrgChartPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    userApi
      .list({ limit: 500 })
      .then((res) => {
        setAllUsers(res.data.data.data);
      })
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    const depts = new Map<string, string>();
    allUsers.forEach((u) => {
      if (u.department) depts.set(u.department.id, u.department.name);
    });
    return Array.from(depts.entries()).map(([id, name]) => ({ id, name }));
  }, [allUsers]);

  const buildGraph = useCallback(() => {
    let filtered = allUsers;

    if (!showInactive) {
      filtered = filtered.filter((u) => u.status === "ACTIVE");
    }

    if (filterDept) {
      // Include users in that dept + their ancestors up the chain
      const deptUserIds = new Set(
        filtered.filter((u) => u.department?.id === filterDept).map((u) => u.id)
      );
      // Walk up to include managers
      const allIncluded = new Set(deptUserIds);
      const userMap = new Map(filtered.map((u) => [u.id, u]));
      for (const uid of deptUserIds) {
        let current = userMap.get(uid);
        while (current?.reportsTo) {
          allIncluded.add(current.reportsTo.id);
          current = userMap.get(current.reportsTo.id);
        }
      }
      filtered = filtered.filter((u) => allIncluded.has(u.id));
    }

    if (search) {
      const q = search.toLowerCase();
      const matchIds = new Set(
        filtered
          .filter(
            (u) =>
              u.fullName?.toLowerCase().includes(q) ||
              u.username?.toLowerCase().includes(q) ||
              u.employeeCode?.toLowerCase().includes(q) ||
              u.role?.name?.toLowerCase().includes(q)
          )
          .map((u) => u.id)
      );
      // Include ancestors + descendants of matches
      const userMap = new Map(filtered.map((u) => [u.id, u]));
      const expanded = new Set(matchIds);
      // Ancestors
      for (const uid of matchIds) {
        let current = userMap.get(uid);
        while (current?.reportsTo) {
          expanded.add(current.reportsTo.id);
          current = userMap.get(current.reportsTo.id);
        }
      }
      // Descendants
      const addDescendants = (parentId: string) => {
        for (const u of filtered) {
          if (u.reportsTo?.id === parentId && !expanded.has(u.id)) {
            expanded.add(u.id);
            addDescendants(u.id);
          }
        }
      };
      for (const uid of matchIds) addDescendants(uid);
      filtered = filtered.filter((u) => expanded.has(u.id));
    }

    // Count subordinates
    const subCounts = new Map<string, number>();
    for (const u of filtered) {
      if (u.reportsTo) {
        subCounts.set(u.reportsTo.id, (subCounts.get(u.reportsTo.id) || 0) + 1);
      }
    }

    const filteredIds = new Set(filtered.map((u) => u.id));

    const newNodes: Node[] = filtered.map((user) => ({
      id: user.id,
      type: "userNode",
      position: { x: 0, y: 0 },
      data: { ...user, subordinateCount: subCounts.get(user.id) || 0 },
    }));

    const newEdges: Edge[] = filtered
      .filter((u) => u.reportsTo && filteredIds.has(u.reportsTo.id))
      .map((u) => ({
        id: `${u.reportsTo!.id}-${u.id}`,
        source: u.reportsTo!.id,
        target: u.id,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        animated: false,
      }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      newNodes,
      newEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [allUsers, search, filterDept, showInactive]);

  useEffect(() => {
    if (allUsers.length > 0) buildGraph();
  }, [allUsers, buildGraph]);

  if (loading) return <TableLoading />;

  return (
    <div>
      <PageHeader
        title="Organization Chart"
        subtitle={`${allUsers.filter((u) => u.status === "ACTIVE").length} active users across the hierarchy`}
      />

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code, or role..."
            className={`${cls.input} pl-8`}
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className={cls.select}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          Show inactive
        </label>
      </div>

      {/* Chart */}
      <div className="rounded-lg bg-white ring-1 ring-gray-200 overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <MiniMap
            nodeStrokeWidth={3}
            pannable
            zoomable
            style={{ height: 100, width: 150 }}
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />

          {/* Legend */}
          <Panel position="top-right">
            <div className="bg-white/90 backdrop-blur rounded-lg border border-gray-200 p-2.5 space-y-1">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Roles</div>
              {[
                { level: 1, label: "CEO" },
                { level: 2, label: "OPS Lead" },
                { level: 3, label: "Community Exec" },
                { level: 4, label: "Manager" },
                { level: 5, label: "Supervisor" },
                { level: 6, label: "Technician" },
              ].map(({ level, label }) => {
                const c = ROLE_COLORS[level];
                return (
                  <div key={level} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded border"
                      style={{ backgroundColor: c.bg, borderColor: c.border }}
                    />
                    <span className="text-[11px] text-gray-600">{label}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

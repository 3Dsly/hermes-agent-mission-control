import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// Real, Postgres-backed task list (DataStore key "dashboard-tasks").
// No external service required -- previously this route silently returned
// hardcoded mock data and faked success on write, with nothing persisted.

interface Task {
  id: string;
  name: string;
  status: string;
  priority: string;
  category: string;
  dueDate?: string | null;
}

const KEY = "dashboard-tasks";

async function loadTasks(): Promise<Task[]> {
  const row = await prisma.dataStore.findUnique({ where: { key: KEY } });
  return Array.isArray(row?.data) ? (row!.data as unknown as Task[]) : [];
}

async function saveTasks(tasks: Task[]) {
  await prisma.dataStore.upsert({
    where: { key: KEY },
    update: { data: tasks as any },
    create: { key: KEY, data: tasks as any },
  });
}

export async function GET() {
  try {
    const tasks = await loadTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Tasks API error:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, status, priority, category } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Task name is required" }, { status: 400 });
    }

    const tasks = await loadTasks();
    const task: Task = {
      id: randomUUID(),
      name: name.trim(),
      status: status || "Not started",
      priority: priority || "Medium",
      category: category || "",
    };
    tasks.push(task);
    await saveTasks(tasks);

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    const tasks = await loadTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    task.status = status;
    await saveTasks(tasks);

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

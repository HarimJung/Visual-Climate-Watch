import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { AuditLog, InsertUser, LearningProgress, SavedComparison, SyncRun, auditLogs, learningProgress, savedComparisons, syncRuns, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createSavedComparison(input: { userId: number; name: string; countriesJson: string; metric: string }): Promise<SavedComparison | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(savedComparisons).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(savedComparisons).where(eq(savedComparisons.id, id)).limit(1);
  return rows[0];
}

export async function listSavedComparisons(userId: number): Promise<SavedComparison[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savedComparisons).where(eq(savedComparisons.userId, userId));
}

export async function saveLearningProgress(input: { userId: number; pathId: string; completedStepsJson: string }): Promise<LearningProgress | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(learningProgress).values(input);
  const rows = await db.select().from(learningProgress).where(eq(learningProgress.userId, input.userId)).limit(1);
  return rows[0];
}

export async function listLearningProgress(userId: number): Promise<LearningProgress[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(learningProgress).where(eq(learningProgress.userId, userId));
}

export async function createAuditLog(input: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(input);
}

export async function listAuditLogs(): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs);
}

export async function createSyncRun(input: Omit<SyncRun, "id" | "createdAt">): Promise<SyncRun | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(syncRuns).values(input);
  const rows = await db.select().from(syncRuns).where(eq(syncRuns.runId, input.runId)).limit(1);
  return rows[0];
}

export async function listSyncRuns(): Promise<SyncRun[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(syncRuns);
}

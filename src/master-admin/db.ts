import { db as firestore } from "@/integrations/firebase/client";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";

class CompatQueryBuilder {
  private colName: string;
  private constraints: any[] = [];
  private orderField: string | null = null;
  private orderDir: 'asc' | 'desc' = 'asc';
  private limitCount: number | null = null;
  private isDelete = false;
  private isMaybeSingle = false;
  private isUpsert = false;
  private upsertData: any = null;

  constructor(colName: string) {
    this.colName = colName;
  }

  select(fields?: string) {
    // Firestore always returns full documents client-side, so select is a no-op
    return this;
  }

  eq(field: string, value: any) {
    // If querying by 'id' in Firestore, we query by document name/id using '__name__'
    const f = field === "id" ? "__name__" : field;
    this.constraints.push(where(f, "==", value));
    return this;
  }

  gte(field: string, value: any) {
    const f = field === "id" ? "__name__" : field;
    this.constraints.push(where(f, ">=", value));
    return this;
  }

  lte(field: string, value: any) {
    const f = field === "id" ? "__name__" : field;
    this.constraints.push(where(f, "<=", value));
    return this;
  }

  in(field: string, values: any[]) {
    const f = field === "id" ? "__name__" : field;
    this.constraints.push(where(f, "in", values));
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderDir = opts?.ascending === false ? 'desc' : 'asc';
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  upsert(data: any) {
    this.isUpsert = true;
    this.upsertData = data;
    return this;
  }

  // To support both promise chain (.then) and direct await on query builder
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any): Promise<any> {
    const p = (async () => {
      try {
        // Map Supabase table name to Firestore collection name
        let name = this.colName;
        if (name === "seller_products") name = "products";

        const colRef = collection(firestore, name);

        if (this.isUpsert) {
          const id = this.upsertData?.id || this.upsertData?.key || doc(colRef).id;
          const docRef = doc(firestore, name, id);
          await setDoc(docRef, this.upsertData, { merge: true });
          return { data: this.upsertData, error: null };
        }

        if (this.isDelete) {
          let q = query(colRef, ...this.constraints);
          const snap = await getDocs(q);
          const deletePromises = snap.docs.map((d) => deleteDoc(d.ref));
          await Promise.all(deletePromises);
          return { data: null, error: null };
        } else {
          let q = query(colRef, ...this.constraints);
          if (this.orderField) {
            q = query(q, orderBy(this.orderField, this.orderDir));
          }
          if (this.limitCount !== null) {
            q = query(q, limit(this.limitCount));
          }
          const snap = await getDocs(q);
          const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          if (this.isMaybeSingle) {
            return { data: data.length > 0 ? data[0] : null, error: null };
          }
          return { data, error: null };
        }
      } catch (err: any) {
        console.warn("CompatQueryBuilder error on", this.colName, err);
        return { data: null, error: { message: err.message || String(err) } };
      }
    })();
    return p.then(onfulfilled, onrejected);
  }

  onSnapshot(callback: (res: { data: any; error: any }) => void) {
    let name = this.colName;
    if (name === "seller_products") name = "products";
    const colRef = collection(firestore, name);

    let q = query(colRef, ...this.constraints);
    if (this.orderField) {
      q = query(q, orderBy(this.orderField, this.orderDir));
    }
    if (this.limitCount !== null) {
      q = query(q, limit(this.limitCount));
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        callback({ data, error: null });
      },
      (err) => {
        callback({ data: null, error: { message: err.message || String(err) } });
      }
    );

    return unsub;
  }
}

export const db = {
  from: (tableName: string) => {
    return new CompatQueryBuilder(tableName);
  }
};
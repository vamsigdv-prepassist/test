import { db, storage } from "./firebase";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { supabase } from "./supabase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// Foundational UPSC Classification Nodes
export const CORE_SUBJECTS = ["Geography", "History", "Art & Culture", "Economy", "Environment", "Polity", "Science and Technology"];

export const OPTIONAL_SUBJECTS = ["Geography", "History", "Public Administration", "Political Science & IR", "Sociology", "Psychology", "Philosophy", "Economics", "Anthropology"];

export const OTHER_SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Statistics", "Botany", "Zoology", "Geology", "Agriculture", "Animal Husbandry", "Civil Engineering", "Electrical Engineering", "Mechanical Engineering"];

// Strict Typings ensuring polymorphic Note bounds
export type NoteType = 'text' | 'file' | 'camera' | 'url';

export interface UpdatePayload {
  title: string;
  source: string;
  date: string;
  excerpt: string;
}

export interface CloudNote {
  id?: string;
  userId: string;
  title: string;
  subject: string;
  categoryType: 'core' | 'optional' | 'other';
  type: NoteType;
  content: string; // The extracted AI Text, manual text, or Web Scrape
  fileUrl?: string; // For physical PDFs or Images
  sourceUrl?: string; // For Web scrapes
  tags?: string[]; // Native explicitly defined global Hashtag array
  hasUpdates?: boolean; // Evaluates dynamically against Current Affairs DB
  updatesList?: UpdatePayload[]; // Explicit structural data of matched nodes
  fileSizeBytes?: number; // Physical footprint calculation stored securely
  createdAt?: number;
  disableUpdates?: boolean; // Flag to stop checking for updates
  isStarred?: boolean; // Starred or favorite note
  lastSyncDate?: number; // Epoch tracking when last synced against DB
}

export const uploadNoteStorage = async (file: File, userId: string): Promise<string> => {
   const ext = file.name.split('.').pop();
   const cleanName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
   
   const { data, error } = await supabase.storage
      .from('cloud_vault')
      .upload(cleanName, file, { upsert: false });
      
   if (error) {
      console.error("Supabase Storage Upload Error:", error);
      throw new Error(`STORAGE_CRASH: ${error.message}`);
   }
   
   const { data: { publicUrl } } = supabase.storage
      .from('cloud_vault')
      .getPublicUrl(cleanName);
      
   return publicUrl;
};

export const saveCloudNote = async (note: CloudNote): Promise<string> => {
  try {
    const noteId = note.id || "local_" + Date.now().toString(36);
    
    // Intelligence checks against Live Admin Cloud DB utilizing rigorous Hashtag Tracking Matrix
    let activeUpdates: UpdatePayload[] = [];
    if (note.tags && note.tags.length > 0 && !note.disableUpdates) {
       activeUpdates = await checkTopicUpdates(note.tags);
    }

    const finalNote = {
      ...note,
      id: noteId,
      hasUpdates: activeUpdates.length > 0,
      updatesList: activeUpdates,
      createdAt: note.createdAt || Date.now(),
      lastSyncDate: activeUpdates.length > 0 ? Date.now() : note.lastSyncDate
    };
    
    // Clean payload of all explicit undefined values to natively prevent Firebase crashing
    const firestorePayload: any = {
       ...finalNote,
       isVerified: false // Explicitly enforce Admin oversight initially via Triage Matrix
    };
    Object.keys(firestorePayload).forEach(key => {
       if (firestorePayload[key] === undefined) delete firestorePayload[key];
    });

    // Make it fully sync to Firestore
    await setDoc(doc(db, "cloud_notes", noteId), firestorePayload);

    return noteId;
  } catch (error) {
    console.error("Cloud Vault Save Error:", error);
    throw error;
  }
};

export const formatBytes = (bytes: number, decimals = 2) => {
   if (!+bytes) return '0 Bytes';
   const k = 1024;
   const dm = decimals < 0 ? 0 : decimals;
   const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
   const i = Math.floor(Math.log(bytes) / Math.log(k));
   return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const fetchCloudNotes = async (userId: string): Promise<CloudNote[]> => {
  try {
    const q = query(collection(db, "cloud_notes"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const existing: CloudNote[] = [];
    snap.forEach(doc => {
        existing.push(doc.data() as CloudNote);
    });
    
    // Natively sort desc by createdAt
    return existing.sort((a, b) => {
       const timeA = typeof a.createdAt === 'number' ? a.createdAt : 0;
       const timeB = typeof b.createdAt === 'number' ? b.createdAt : 0;
       return timeB - timeA;
    });
  } catch (error) {
    console.error("Cloud Vault Fetch Error:", error);
    throw error;
  }
};

export const checkTopicUpdates = async (tags: string[] = []): Promise<UpdatePayload[]> => {
   // Intelligence Engine checks rigorously if recent global data maps natively to the explicit User Hashtags
   try {
      if (!tags || tags.length === 0) return [];

      let lowerTags = tags.map(t => t.toLowerCase().trim());
      // array-contains-any forces a hard structural limit of exactly 10 parameters natively 
      if (lowerTags.length > 10) lowerTags = lowerTags.slice(0, 10);
      
      const qAffairs = query(
         collection(db, "current_affairs"),
         where("tags", "array-contains-any", lowerTags)
      );

      const qGlobalNotes = query(
         collection(db, "cloud_notes"),
         where("tags", "array-contains-any", lowerTags)
      );

      // Execute both hashtag pipelines concurrently for zero latency natively
      const [affairsSnap, notesSnap] = await Promise.all([
          getDocs(qAffairs),
          getDocs(qGlobalNotes)
      ]);

      let updates: UpdatePayload[] = [];
      
      affairsSnap.forEach(doc => {
         const data = doc.data();
         updates.push({
            title: data.title || "Target Synchronization Node",
            source: data.source || data.sourceType || "Daily Global DB",
            date: data.publishDate || data.publishedDate || new Date().toISOString().split('T')[0],
            excerpt: data.content ? data.content.substring(0, 110) + "..." : "Additional synchronization parameters mapped securely."
         });
      });

      notesSnap.forEach(doc => {
         const data = doc.data();
         // Structural Security: ONLY ingest heavily verified nodes approved by Admin Triage OR Global Database explicitly.
         if (data.isVerified === true) {
             updates.push({
                 title: `[Community Insight] ${data.title || "Subject Note"}`,
                 source: `Global Database Matrix`,
                 date: data.createdAt ? new Date(data.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                 excerpt: data.content ? data.content.substring(0, 110) + "..." : "Mapping new database matrix intelligence."
             });
         }
      });

      return updates;
   } catch(e) {
      return []; // Fail silently preventing UI locking natively
   }
};

export const deleteCloudNote = async (note: CloudNote): Promise<void> => {
   try {
      if (note.id) {
         await deleteDoc(doc(db, "cloud_notes", note.id));
      }
   } catch(error) {
      console.error("Cloud Vault Deletion Error:", error);
      throw error;
   }
};

export const bulkUpdateCloudNotes = async (userId: string, noteIds: string[], updatePayload: Partial<CloudNote>): Promise<void> => {
   try {
      const batch = writeBatch(db);
      noteIds.forEach(id => {
         const sfRef = doc(db, "cloud_notes", id);
         batch.update(sfRef, updatePayload);
      });
      await batch.commit();
   } catch (error) {
      console.error("Cloud Vault Bulk Update Error:", error);
      throw error;
   }
};

export const bulkDeleteCloudNotes = async (userId: string, noteIds: string[]): Promise<void> => {
   try {
      const batch = writeBatch(db);
      noteIds.forEach(id => {
         const sfRef = doc(db, "cloud_notes", id);
         batch.delete(sfRef);
      });
      await batch.commit();
   } catch (error) {
      console.error("Cloud Vault Bulk Deletion Error:", error);
      throw error;
   }
};

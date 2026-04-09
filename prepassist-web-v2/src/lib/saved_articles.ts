import { db } from "./firebase";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";

export interface SavedWebsite {
  id: string;
  userId: string;
  url: string;
  domain: string;
  title?: string;
  dateAdded: number;
}

export const fetchSavedWebsites = async (userId: string): Promise<SavedWebsite[]> => {
  try {
    const q = query(collection(db, "saved_websites"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const existing: SavedWebsite[] = [];
    snap.forEach(doc => {
        existing.push(doc.data() as SavedWebsite);
    });
    return existing.sort((a, b) => b.dateAdded - a.dateAdded);
  } catch (error) {
    console.error("Cloud Saved Websites Fetch Error:", error);
    return [];
  }
};

export const addSavedWebsite = async (url: string, userId: string, title?: string): Promise<SavedWebsite> => {
  try {
    let domain = "Unknown Domain";
    try {
      const parsedUrl = new URL(url);
      domain = parsedUrl.hostname.replace('www.', '');
    } catch {
      domain = url.split('/')[0] || "Unknown";
    }

    const newSiteId = "site_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newSite: SavedWebsite = {
      id: newSiteId,
      userId,
      url,
      domain,
      title: title || domain,
      dateAdded: Date.now()
    };

    await setDoc(doc(db, "saved_websites", newSiteId), newSite);
    
    return newSite;
  } catch (error) {
    console.error("Cloud Saved Websites Add Error:", error);
    throw error;
  }
};

export const deleteSavedWebsite = async (id: string, userId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "saved_websites", id));
  } catch (error) {
    console.error("Cloud Saved Websites Delete Error:", error);
    throw error;
  }
};

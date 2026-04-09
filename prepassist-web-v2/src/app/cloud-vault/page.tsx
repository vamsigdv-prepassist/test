"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { fetchCloudNotes, deleteCloudNote, CloudNote, formatBytes } from "@/lib/cloud_notes";
import { storage } from "@/lib/firebase";
import { ref, deleteObject } from "firebase/storage";
import { Database, FileText, Download, Trash2, Loader2, ArrowUpRight, Search, Clock, AlertTriangle, Hash, ArrowUpDown, HardDrive } from "lucide-react";

export default function CloudVaultManager() {
   const [notes, setNotes] = useState<CloudNote[]>([]);
   const [userId, setUserId] = useState<string | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [isDeleting, setIsDeleting] = useState<string | null>(null);
   const [searchQuery, setSearchQuery] = useState("");
   const [sortBy, setSortBy] = useState<"date" | "size">("date");

   useEffect(() => {
      const initVault = async () => {
         const { data: { session } } = await supabase.auth.getSession();
         if (!session) {
            window.location.href = "/login";
            return;
         }
         
         const uid = session.user.id;
         setUserId(uid);
         
         try {
            const data = await fetchCloudNotes(uid);
            setNotes(data);
         } catch (e) {
            console.error("Failed to hydrate Vault Data.");
         }
         setIsLoading(false);
      };
      
      initVault();
   }, []);

   const handleDeleteNode = async (note: CloudNote) => {
      if (!confirm("Are you absolutely sure you want to permanently purge this document from your Cloud Database? This is non-reversible.")) return;
      
      setIsDeleting(note.id || "processing");
      
      try {
         if (note.fileUrl) {
            try {
               if (note.fileUrl.includes("firebasestorage")) {
                  const fileRef = ref(storage, note.fileUrl);
                  await deleteObject(fileRef);
               } else if (note.fileUrl.includes("supabase.co")) {
                  const urlParts = note.fileUrl.split("/cloud_vault/");
                  if (urlParts.length > 1) {
                     const filePath = urlParts[1];
                     await supabase.storage.from("cloud_vault").remove([filePath]);
                  }
               }
            } catch (storageError) {
               console.error("Storage Purge Missed/Skipped:", storageError);
            }
         }

         await deleteCloudNote(note);
         setNotes(prev => prev.filter(n => n.id !== note.id));
      } catch (e: any) {
         alert("Failed to securely purge data: " + e.message);
      }
      
      setIsDeleting(null);
   };

   const totalUploads = notes.length;
   const documentNodesCount = notes.filter(n => n.type === 'file').length;
   
   const getWeight = (n: CloudNote) => n.fileSizeBytes || 102400;

   // Execution Array: Natively combine filter string with sorting schema
   let displayedNotes = [...notes];
   if (sortBy === "size") {
      displayedNotes.sort((a, b) => getWeight(b) - getWeight(a));
   } else {
      displayedNotes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
   }

   displayedNotes = displayedNotes.filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.subject.toLowerCase().includes(searchQuery.toLowerCase())
   );

   return (
      <div className="min-h-screen bg-[#FDFCFB] text-slate-800 font-sans pb-24 selection:bg-indigo-500/20">
         
         {/* Hero Header Area */}
         <div className="bg-white border-b border-slate-200">
            <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-12">
               
               <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                  <div className="space-y-4 max-w-3xl">
                     <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
                        <Database className="w-3.5 h-3.5" /> User Cloud Array
                     </div>
                     <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                        Secured Data Vault
                     </h1>
                     <p className="text-slate-500 font-medium text-lg leading-relaxed">
                        Complete chronological tracker of every PDF, document, and structural text node you have explicitly injected into our Cloud infrastructure. Total control over your raw data arrays.
                     </p>
                  </div>
                  
                  {/* Quick Metric Dashboard */}
                  <div className="grid grid-cols-2 gap-4 shrink-0 mt-4 md:mt-0">
                     <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex flex-col justify-center min-w-[140px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Vault Nodes</span>
                        <span className="text-3xl font-black text-slate-900">{totalUploads}</span>
                     </div>
                     <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex flex-col justify-center min-w-[140px]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">Physical Blobs (PDF)</span>
                        <span className="text-3xl font-black text-indigo-700">{documentNodesCount}</span>
                     </div>
                  </div>
               </div>

            </div>
         </div>

         {/* Tracking Array Console */}
         <div className="max-w-[1600px] mx-auto px-6 lg:px-10 mt-10">
            
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 bg-white p-2 md:p-3 rounded-2xl border border-slate-200 shadow-sm">
               <div className="relative w-full md:w-[400px] flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input 
                     type="text" 
                     placeholder="Query documents by Title or Subject Matrix..."
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     className="w-full bg-slate-50 rounded-xl py-3 pl-12 pr-4 text-sm font-medium border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 text-slate-900"
                  />
               </div>
               
               <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto custom-scrollbar">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 shrink-0 px-3">
                     <ArrowUpDown className="w-4 h-4"/> Sort Scope:
                  </span>
                  <button 
                     onClick={() => setSortBy("date")}
                     className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0 ${sortBy === 'date' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                  >
                     Chronology Pipeline
                  </button>
                  <button 
                     onClick={() => setSortBy("size")}
                     className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0 ${sortBy === 'size' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                  >
                     Memory Weight
                  </button>
               </div>
            </div>

            {isLoading ? (
               <div className="flex flex-col items-center justify-center h-[40vh]">
                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                  <p className="text-xs font-black tracking-widest text-slate-400 uppercase">Synchronizing with Firebase Vault...</p>
               </div>
            ) : displayedNotes.length === 0 ? (
               <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-16 flex flex-col items-center justify-center text-center mt-6">
                  <Database className="w-16 h-16 text-slate-300 mb-6" />
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Silo is Empty</h3>
                  <p className="text-slate-500 font-medium">You haven't pushed any Raw Notes or PDFs into the Vault Array yet. Or your search query returned zero matches.</p>
               </div>
            ) : (
               <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  
                  {/* Table Headers */}
                  <div className="grid grid-cols-12 gap-4 p-6 bg-slate-50 border-b border-slate-100 text-[10px] lg:text-xs font-black uppercase tracking-widest text-slate-400">
                     <div className="col-span-12 md:col-span-4">Data Payload (Title / Matrix)</div>
                     <div className="col-span-4 md:col-span-2">Format</div>
                     <div className="col-span-4 md:col-span-2">Memory Size</div>
                     <div className="col-span-4 md:col-span-2">Chronology (Time)</div>
                     <div className="col-span-12 md:col-span-2 flex justify-end">Access Controls</div>
                  </div>

                  <div className="divide-y divide-slate-100">
                     <AnimatePresence>
                        {displayedNotes.map((note) => {
                           const isLegacy = !note.fileSizeBytes;
                           const displayedBytes = formatBytes(getWeight(note));

                           return (
                           <motion.div 
                              key={note.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, height: 0 }}
                              className="grid grid-cols-12 gap-y-4 md:gap-4 p-6 items-center transition-colors hover:bg-slate-50 group"
                           >
                              
                              {/* Root Target Block */}
                              <div className="col-span-12 md:col-span-4 flex items-start gap-4 pr-4">
                                 <div className={`p-3 rounded-xl shrink-0 ${note.type === 'file' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    <FileText className="w-5 h-5" />
                                 </div>
                                 <div className="pt-1 overflow-hidden min-w-0">
                                    <h4 className="font-bold text-slate-900 text-base mb-1 truncate" title={note.title}>{note.title}</h4>
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                       <Hash className="w-3 h-3"/> {note.subject}
                                    </span>
                                 </div>
                              </div>

                              {/* Format Typology */}
                              <div className="col-span-4 md:col-span-2 flex flex-col justify-center">
                                 <span className={`self-start px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${note.type === 'file' ? 'bg-white border-slate-200 text-slate-600' : 'bg-slate-800 border-slate-900 text-white'}`}>
                                    {note.type === 'file' ? 'PDF Blob' : 'Extracted Text'}
                                 </span>
                              </div>

                              {/* Memory Size Injection */}
                              <div className="col-span-4 md:col-span-2 flex flex-col justify-center">
                                 <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                                    <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                                    {displayedBytes}
                                 </div>
                                 {isLegacy && (
                                    <span className="text-[9px] font-black uppercase tracking-widest w-max text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-1.5">
                                       Legacy Node
                                    </span>
                                 )}
                              </div>

                              {/* Injection Timestamp */}
                              <div className="col-span-4 md:col-span-2 flex flex-col justify-center">
                                 <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    {note.createdAt ? new Date(note.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Archive Era'}
                                 </div>
                                 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1 pl-6">
                                    {note.createdAt ? new Date(note.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '00:00'}
                                 </span>
                              </div>

                              {/* Destructive & Constructive Pipeline Actions */}
                              <div className="col-span-12 md:col-span-2 flex items-center justify-end gap-2 mt-4 md:mt-0">
                                 {note.fileUrl ? (
                                    <a 
                                       href={note.fileUrl} 
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm group-hover:shadow-md outline-none"
                                       title="Download Original Node"
                                    >
                                       <Download className="w-4 h-4" />
                                    </a>
                                 ) : (
                                    <button 
                                       disabled
                                       className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-300 cursor-not-allowed"
                                       title="No Physical Blob Attached"
                                    >
                                       <Download className="w-4 h-4" />
                                    </button>
                                 )}

                                 <button 
                                    onClick={() => handleDeleteNode(note)}
                                    disabled={isDeleting === note.id}
                                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm group-hover:shadow-md disabled:opacity-50 disabled:cursor-wait"
                                    title="Purge Node Permanently"
                                 >
                                    {isDeleting === note.id ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4" />}
                                 </button>
                              </div>

                           </motion.div>
                           );
                        })}
                     </AnimatePresence>
                  </div>
               </div>
            )}
         </div>
         
         <div className="max-w-[1600px] mx-auto px-6 lg:px-10 mt-6">
            <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-indigo-700/80 text-xs font-medium">
               <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
               <p>Warning: Purging a physical blob natively from the Cloud Vault permanently deletes it from Firebase Data Storage Arrays. AI Extracted texts derived from that blob will remain intact in other system scopes unless manually pruned. Legacy Nodes are mapped at roughly 100KB footprint.</p>
            </div>
         </div>

      </div>
   );
}

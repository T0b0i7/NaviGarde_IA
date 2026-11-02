import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle, Archive, ChevronLeft, ChevronRight, Clock, Copy, Download, FileText, Filter, File, MapPin, Plus, Search, Share2, ShieldAlert, X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import "./bullets.css";

type BulletinsImportance = "information" | "important" | "urgent" | "critique";
type BulletinsStatus = "brouillon" | "publie" | "archive";

type MaritimeBulletin = {
  id: number;
  title: string;
  category: string;
  maritimeZone: string;
  importance: BulletinsImportance;
  content: string;
  attachments: string | null;
  status: BulletinsStatus;
  createdBy: number | null;
  validatedBy: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  publishedAt: Date | string | null;
};

function KpiCard({ icon: Icon, label, value, delta }: { icon: any; label: string; value: React.ReactNode; delta?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon">{<Icon size={20} />}</div>
      <div className="kpi-body">
        <p className="kpi-label">{label}</p>
        <div className="kpi-value">{value}</div>
        {delta && <span className="kpi-delta">{delta}</span>}
      </div>
    </div>
  );
}

function ImportanceBadge({ importance }: { importance: BulletinsImportance }) {
  const variants: Record<BulletinsImportance, { color: string; bg: string; label: string }> = {
    information: { color: "text-blue-700", bg: "bg-blue-100", label: "Info" },
    important: { color: "text-orange-700", bg: "bg-orange-100", label: "Avertissement" },
    urgent: { color: "text-red-700", bg: "bg-red-100", label: "Alerte" },
    critique: { color: "text-red-900", bg: "bg-red-50", label: "Critique" },
  };
  const v = variants[importance];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.color} ${v.bg}`}>
      {v.label}
    </span>
  );
}

function StatusBadge({ status }: { status: BulletinsStatus }) {
  const variants: Record<BulletinsStatus, { color: string; bg: string; label: string }> = {
    brouillon: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Brouillon" },
    publie: { color: "text-emerald-700", bg: "bg-emerald-100", label: "Publié" },
    archive: { color: "text-slate-500", bg: "bg-slate-100", label: "Archivé" },
  };
  const v = variants[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.color} ${v.bg}`}>
      {v.label}
    </span>
  );
}

function SelectPill({ label, value, options, onChange, onReset }: { label: string; value: string; options: string[]; onChange: (v: string) => void; onReset: () => void }) {
  return (
    <div className="filter-pill">
      <button className="pill-trigger" onClick={onReset}>{label}</button>
      <select className="pill-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function BulletinsPage() {
  const utils = trpc.useUtils();
  const query = trpc.data.bulletins.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const create = trpc.data.bulletins.create.useMutation({
    onSuccess: () => {
      utils.data.bulletins.list.invalidate();
      toast.success("Bulletin enregistré");
    },
    onError: (err: unknown) => toast.error("Échec de création : " + (err as Error)?.message),
  });
  const update = trpc.data.bulletins.update.useMutation({
    onSuccess: () => {
      utils.data.bulletins.list.invalidate();
      toast.success("Bulletin mis à jour");
    },
    onError: (err: unknown) => toast.error("Échec de mise à jour : " + (err as Error)?.message),
  });

  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tous les types");
  const [zoneFilter, setZoneFilter] = useState("Toutes les zones");
  const [levelFilter, setLevelFilter] = useState("Tous les niveaux");
  const [periodFilter, setPeriodFilter] = useState("Période");
  const [openCreate, setOpenCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [createZone, setCreateZone] = useState("");
  const [createImportance, setCreateImportance] = useState<BulletinsImportance>("information");
  const [selected, setSelected] = useState<MaritimeBulletin | null>(null);
  const [page, setPage] = useState(1);

  const raw = (query.data ?? []) as unknown as MaritimeBulletin[];
  const zones = useMemo(() => [...new Set(raw.map((b) => b.maritimeZone))], [raw]);
  const types = useMemo(() => [...new Set(raw.map((b) => b.category))], [raw]);

  const visible = useMemo(() => {
    const now = new Date();
    return raw.filter((b) => {
      const text = `${b.title} ${b.content} ${b.maritimeZone} ${b.category}`.toLowerCase();
      if (filter && !text.includes(filter.toLowerCase())) return false;
      if (typeFilter !== "Tous les types" && b.category !== typeFilter) return false;
      if (zoneFilter !== "Toutes les zones" && b.maritimeZone !== zoneFilter) return false;
      if (levelFilter !== "Tous les niveaux" && b.importance !== levelFilter) return false;
      if (periodFilter && periodFilter !== "Période") {
        const d = new Date(b.createdAt);
        const days = periodFilter === "24h" ? 1 : periodFilter === "7j" ? 7 : periodFilter === "30j" ? 30 : 0;
        if (days && now.getTime() - d.getTime() > days * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });
  }, [raw, filter, typeFilter, zoneFilter, levelFilter, periodFilter]);

  const PAGE_SIZE = 7;
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  if (safePage !== page) setPage(safePage);
  const paged = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const total = raw.length;
  const enCours = raw.filter((b) => b.status === "brouillon").length;
  const publies = raw.filter((b) => b.status === "publie").length;
  const archives = raw.filter((b) => b.status === "archive").length;

  const handleCreate = () => {
    if (!createTitle || !createContent || !createZone) {
      toast.error("Titre, message et zone maritime sont requis.");
      return;
    }
    create.mutate({
      title: createTitle,
      category: typeFilter === "Tous les types" ? "Avis" : typeFilter,
      maritimeZone: createZone,
      importance: createImportance,
      content: createContent,
      attachments: [],
    });
    setOpenCreate(false);
    setCreateTitle("");
    setCreateContent("");
    setCreateZone("");
    setCreateImportance("information");
  };

  const handlePublish = (id: number) => {
    update.mutate({ id, patch: { status: "publie" } });
    setSelected(null);
  };

  const handleArchive = (id: number) => {
    update.mutate({ id, patch: { status: "archive" } });
    setSelected(null);
  };

  const handleDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Téléchargement lancé");
  };

  const handleShare = () => {
    if (!selected) return;
    if (navigator.share) {
      navigator.share({ title: selected.title, text: selected.content, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${selected.title} — ${selected.content}`).then(() => toast.success("Lien copié"));
    }
  };

  const importanceLabel: Record<BulletinsImportance, string> = {
    information: "Information",
    important: "Important",
    urgent: "Urgent",
    critique: "Critique",
  };

  const fmtDate = (iso: Date | string) =>
    new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <AppShell>
      <div className="bullets-shell">
        {/* Header */}
        <div className="bullets-head">
          <Link href="/" className="back"><ChevronLeft size={16} /> Retour</Link>
          <div className="bullets-title">
            <h1>Bulletins maritimes</h1>
            <p>Consultez les derniers bulletins et restez informé des alertes en mer.</p>
          </div>
          <button className="new-bulletin" onClick={() => setOpenCreate(true)}>
            <Plus size={16} /> Nouveau bulletin
          </button>
        </div>

        {/* KPI cards */}
        <div className="kpi-row">
          <KpiCard icon={FileText} label="Total des bulletins" value={total} delta="+12%" />
          <KpiCard icon={AlertTriangle} label="En cours" value={enCours} />
          <KpiCard icon={ShieldAlert} label="Publiés" value={publies} />
          <KpiCard icon={Archive} label="Archivés" value={archives} />
        </div>

        {/* Search + filters */}
        <div className="bullets-toolbar">
          <div className="toolbar-search wide">
            <Search size={16} />
            <input
              placeholder="Rechercher un bulletin, une zone maritime, un mot-clé..."
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(1); }}
            />
          </div>
          <div className="filter-chips">
            <SelectPill label="Tous les types" value={typeFilter} options={types} onChange={(v) => { setTypeFilter(v); setPage(1); }} onReset={() => { setTypeFilter("Tous les types"); setPage(1); }} />
            <SelectPill label="Toutes les zones" value={zoneFilter} options={zones} onChange={(v) => { setZoneFilter(v); setPage(1); }} onReset={() => { setZoneFilter("Toutes les zones"); setPage(1); }} />
            <SelectPill
              label="Tous les niveaux"
              value={levelFilter}
              options={["Tous les niveaux", "Information", "Important", "Urgent", "Critique"]}
              onChange={(v) => { setLevelFilter(v as BulletinsImportance); setPage(1); }}
              onReset={() => { setLevelFilter("Tous les niveaux"); setPage(1); }}
            />
            <SelectPill label="Période" value={periodFilter} options={["Période", "24h", "7j", "30j"]} onChange={(v) => { setPeriodFilter(v); setPage(1); }} onReset={() => { setPeriodFilter("Période"); setPage(1); }} />
            <button className="filter-btn" onClick={() => { setFilter(""); setTypeFilter("Tous les types"); setZoneFilter("Toutes les zones"); setLevelFilter("Tous les niveaux"); setPeriodFilter("Période"); setPage(1); }}>
              <Filter size={14} /> Filtres
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table className="bullets-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Titre</th>
                <th>Type</th>
                <th>Zone concernée</th>
                <th>Niveau</th>
                <th>Date de publication</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((b) => {
                const num = (safePage - 1) * PAGE_SIZE + paged.indexOf(b) + 1;
                return (
                  <tr key={b.id} className="bulletin-row" onClick={() => setSelected(b)}>
                    <td className="num">BM-{new Date(b.createdAt).getFullYear()}-{String(b.id).padStart(3, "0")}</td>
                    <td>
                      <div className="row-title"><strong>{b.title}</strong></div>
                      <div className="row-excerpt">{b.content.slice(0, 90)}…</div>
                    </td>
                    <td><ImportanceBadge importance={b.importance} /></td>
                    <td>{b.maritimeZone}</td>
                    <td><ImportanceBadge importance={b.importance} /></td>
                    <td>{fmtDate(b.createdAt)}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td className="text-right">
                      <button className="icon-btn" title="Voir le détail" onClick={(e) => { e.stopPropagation(); setSelected(b); }}><ChevronRight size={14} /></button>
                      <button className="icon-btn" title={b.status === "publie" ? "Archiver" : "Publier"} onClick={(e) => { e.stopPropagation(); b.status === "publie" ? handleArchive(b.id) : handlePublish(b.id); }}>
                        {b.status === "publie" ? <Archive size={14} /> : <ShieldAlert size={14} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-footer">
            <span className="pagination-info">
              Affichage de {paged.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} à {Math.min(safePage * PAGE_SIZE, visible.length)} sur {visible.length} bulletins
            </span>
            <div className="pagination">
              <button className={`page-btn ${safePage === 1 ? "disabled" : ""}`} disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={14} /></button>
              {[1, 2, 3, 4, 5].filter((p) => p <= totalPages).map((p) => (
                <button key={p} className={`page-btn ${safePage === p ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              {totalPages > 5 && <span className="ellipsis">…</span>}
              {totalPages > 5 && <button className="page-btn" onClick={() => setPage(totalPages)}>{totalPages}</button>}
              <button className={`page-btn ${safePage === totalPages ? "disabled" : ""}`} disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail drawer (right panel like the image) */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <aside className="drawer-panel">
            <div className="drawer-header">
              <button className="close-drawer" onClick={() => setSelected(null)}><X size={18} /></button>
              <h2>Détail du bulletin</h2>
            </div>
            <div className="drawer-body">
              <div className="detail-image-wrap">
                <img src="https://images.unsplash.com/photo-1577239987131-e8f972a38b7f?q=80&w=1000&auto=format&fit=crop" alt="Bulletin" />
                <span className="detail-alert">Alerte</span>
              </div>
              <div className="detail-meta">
                <h3>{selected.title}</h3>
                <div className="detail-date"><Clock size={14} /> {fmtDate(selected.createdAt)} &nbsp;|&nbsp; <MapPin size={14} /> {selected.maritimeZone}</div>
                <div className="detail-level">{importanceLabel[selected.importance]}</div>
              </div>
              <div className="detail-section">
                <h4>Résumé</h4>
                <p>{selected.content}</p>
              </div>
              <div className="detail-section">
                <h4>Recommandations</h4>
                <ul className="recos">
                  <li><span style={{ display: "inline-block", width: 14, height: 14 }}>{"✔"}</span> Éviter la navigation en haute mer.</li>
                  <li><span style={{ display: "inline-block", width: 14, height: 14 }}>{"✔"}</span> Renforcer la surveillance des côtes.</li>
                  <li><span style={{ display: "inline-block", width: 14, height: 14 }}>{"✔"}</span> Suivre les mises à jour officielles.</li>
                </ul>
              </div>
              <div className="detail-section">
                <h4>Pièces jointes</h4>
                <div className="attachments">
                  {(selected.attachments ? JSON.parse(selected.attachments) : []).map((url: string, i: number) => (
                    <div key={i} className="attachment-item">
                      <File size={14} /> <span>Bulletin_Maritime_{String(selected.id).padStart(3, "0")}.pdf</span>
                      <button className="download-btn" onClick={(e) => { e.stopPropagation(); handleDownload(url); }}><Download size={14} /></button>
                    </div>
                  ))}
                  {(selected.attachments ? JSON.parse(selected.attachments) : []).length === 0 && <div className="attachment-item empty">Aucune pièce jointe</div>}
                </div>
              </div>
              <div className="detail-actions">
                <button className="download-all" onClick={() => { handleDownload("#"); toast.info("Téléchargement du lot préparé"); }}>
                  <Download size={16} /> Télécharger
                </button>
                <button className="share-btn" onClick={(e) => { e.stopPropagation(); handleShare(); }}>
                  <Share2 size={16} /> Partager
                </button>
              </div>
              <div className="drawer-actions-bottom">
                <button className="btn-toggle" onClick={() => { selected.status === "publie" ? handleArchive(selected.id) : handlePublish(selected.id); }}>
                  {selected.status === "publie" ? "Archiver" : "Publier"}
                </button>
                <button className="btn-close" onClick={() => setSelected(null)}>Fermer</button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* Create modal */}
      {openCreate && (
        <div className="modal-overlay" onClick={() => setOpenCreate(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="eyebrow">Diffusion terrain</span>
              <h2>Créer un avis maritime</h2>
              <button className="modal-close" onClick={() => setOpenCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
              <label className="field"><span>Titre</span><input autoFocus value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Ex: Forte houles sur le Golfe de Guinée" /></label>
              <label className="field"><span>Zone maritime</span><input value={createZone} onChange={(e) => setCreateZone(e.target.value)} placeholder="Ex: Golfe de Guinée" /></label>
              <label className="field"><span>Niveau</span><select value={createImportance} onChange={(e) => setCreateImportance(e.target.value as BulletinsImportance)}>
                <option value="information">Information</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
                <option value="critique">Critique</option>
              </select></label>
              <label className="field"><span>Message / contenu</span><textarea className="text-area" value={createContent} onChange={(e) => setCreateContent(e.target.value)} rows={4} placeholder="Décrivez la situation maritime…" /></label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setOpenCreate(false)}>Annuler</button>
                <button type="submit" className="primary-button" disabled={create.isPending}>{create.isPending ? "Enregistrement…" : "Enregistrer le bulletin"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

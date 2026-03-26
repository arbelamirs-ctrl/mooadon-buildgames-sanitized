// src/lib/responsive.js
// Mooadon – shared responsive utility classes
// Usage: import { r } from '@/lib/responsive';

export const r = {
  // ── Grids ──
  statsGrid:        "grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4",
  cardsGrid:        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6",
  twoColGrid:       "grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6",
  threeColGrid:     "grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4",
  mainWithSidebar:  "grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 lg:gap-6",
  mainWide:         "grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] gap-4 lg:gap-6",

  // ── Containers ──
  page:        "p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6",
  card:        "p-3 sm:p-4 lg:p-6",
  section:     "space-y-3 sm:space-y-4",

  // ── Buttons ──
  btnGroup:    "flex flex-col sm:flex-row gap-2 sm:gap-3",
  btnFull:     "w-full sm:w-auto h-10 min-w-[44px]",

  // ── Typography ──
  pageTitle:   "text-lg sm:text-xl lg:text-2xl font-semibold text-white",
  pageSub:     "text-xs sm:text-sm text-slate-400",
  label:       "text-xs sm:text-sm text-slate-300",

  // ── Tables ──
  tableWrap:   "overflow-x-auto -mx-3 sm:mx-0",
  hideMobile:  "hidden sm:table-cell",

  // ── Tabs ──
  tabsList:    "overflow-x-auto flex-nowrap",
  tabsTrigger: "shrink-0 text-xs sm:text-sm",

  // ── Horizontal scroll (templates, chips) ──
  hScroll:     "flex overflow-x-auto gap-3 snap-x snap-mandatory pb-2 -mx-3 px-3 sm:mx-0 sm:px-0",
  hScrollItem: "shrink-0 snap-start",

  // ── Forms ──
  formRow:     "flex flex-col sm:flex-row gap-3",
  input:       "w-full",

  // ── QR / Images ──
  qr:          "w-[150px] sm:w-[200px] lg:w-[250px]",
};

// Keep old export name for backwards compat
export const responsive = r;
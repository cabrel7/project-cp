<!-- shadcn-vue — @tanstack/vue-table avec composants Table primitifs -->
<template>
  <div class="rounded-[--radius-lg] border border-[--line] overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
          <TableHead
            v-for="header in headerGroup.headers"
            :key="header.id"
            :class="header.column.columnDef.meta?.class"
            class="cursor-pointer select-none"
            @click="header.column.getToggleSortingHandler()?.($event)"
          >
            <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
            <span v-if="header.column.getIsSorted()">
              {{ header.column.getIsSorted() === 'asc' ? '▴' : '▾' }}
            </span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          class="cursor-pointer"
          @click="onRowClick(row.original)"
        >
          <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id" :class="cell.column.columnDef.meta?.class">
            <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <div class="flex items-center justify-between px-4 py-3 text-[--ink-muted] text-[13px]">
      <span>{{ startIndex }}–{{ endIndex }} sur {{ total }} agents</span>
      <div class="flex gap-3">
        <Button variant="ghost" size="sm" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()">
          ← Précédent
        </Button>
        <Button variant="ghost" size="sm" :disabled="!table.getCanNextPage()" @click="table.nextPage()">
          Suivant →
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVueTable, FlexRender, getCoreRowModel, getSortedRowModel } from '@tanstack/vue-table'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

const table = useVueTable({
  data: props.rows,
  columns: [
    { accessorKey: 'name', header: 'Nom', cell: ({ row }) => h('strong', row.getValue('name')) },
    { accessorKey: 'type', header: 'Type' },
    { accessorKey: 'status', header: 'Statut', cell: ({ row }) => h(CpStatusBadge, { status: row.getValue('status') }) },
    { accessorKey: 'runs', header: 'Exécutions', meta: { class: 'text-right tabular-nums' } },
    { accessorKey: 'credits', header: 'Crédits', meta: { class: 'text-right tabular-nums' }, cell: ({ row }) => formatCredits(row.getValue('credits')) },
    { accessorKey: 'lastRun', header: 'Dernière exécution', cell: ({ row }) => h('span', { class: 'text-[--ink-muted]' }, timeAgo(row.getValue('lastRun'))) },
  ],
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})
</script>

<!--
  + : @tanstack/vue-table est la référence pour les tableaux complexes
  + : contrôle pixel-perfect sur chaque cellule
  + : tri, filtres, groupement, virtualisation — tout est disponible
  - : ~65 lignes contre ~25 pour UTable — beaucoup de boilerplate
  - : Table/TableHeader/TableRow/TableHead/TableBody/TableCell = 6 primitifs à importer
  - : pas de gestion native du chargement, de l'état vide, de la sélection (à construire)
  - : mode carte mobile = template conditionnel complet à écrire
-->

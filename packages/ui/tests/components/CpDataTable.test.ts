import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataTable from '../../app/components/Cp/DataTable.vue'

const columns = [
  { key: 'name', label: 'Nom', sortable: true },
  { key: 'runs', label: 'Exécutions', sortable: true },
  { key: 'owner', label: 'Responsable' },
]
const rows = [
  { name: 'Relances', runs: 12, owner: 'Awa' },
  { name: 'Devis', runs: 3, owner: 'Koffi' },
  { name: 'Factures', runs: 40, owner: null },
]

const names = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('[data-cell="name"]').map((c) => c.text())

describe('CpDataTable', () => {
  it('affiche les en-têtes et les lignes', () => {
    const wrapper = mount(DataTable, { props: { columns, rows } })
    expect(
      wrapper
        .findAll('th')
        .map((h) => h.text().replace(/ (Non trié|Tri croissant|Tri décroissant)$/, '')),
    ).toEqual(['Nom', 'Exécutions', 'Responsable'])
    expect(wrapper.findAll('[data-row]')).toHaveLength(3)
    expect(names(wrapper)).toEqual(['Relances', 'Devis', 'Factures'])
  })

  it('affiche une cellule vide pour null', () => {
    const wrapper = mount(DataTable, { props: { columns, rows } })
    expect(wrapper.findAll('[data-cell="owner"]')[2]?.text()).toBe('')
  })

  it('chargement : squelette, pas de tableau ni état vide', () => {
    const wrapper = mount(DataTable, { props: { columns, rows: [], loading: true } })
    expect(wrapper.findAll('[data-cp-skeleton]').length).toBeGreaterThan(0)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('[data-cp-empty-state]').exists()).toBe(false)
    expect(wrapper.get('[aria-label]').attributes('aria-label')).toBe('Chargement des données…')
  })

  it('vide : EmptyState avec le texte i18n par défaut', () => {
    const wrapper = mount(DataTable, { props: { columns, rows: [] } })
    expect(wrapper.find('[data-cp-empty-state]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Aucun résultat')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('vide : emptyText personnalisé', () => {
    const wrapper = mount(DataTable, { props: { columns, rows: [], emptyText: 'Aucun assistant' } })
    expect(wrapper.text()).toContain('Aucun assistant')
  })

  it('slot de cellule personnalisé', () => {
    const wrapper = mount(DataTable, {
      props: { columns, rows },
      slots: { 'cell-name': '<template #cell-name="{ row }"><b>{{ row.name }}!</b></template>' },
    })
    expect(wrapper.findAll('[data-cell="name"] b').map((b) => b.text())).toEqual([
      'Relances!',
      'Devis!',
      'Factures!',
    ])
  })

  it('tri : croissant puis décroissant, état de tri annoncé', async () => {
    const wrapper = mount(DataTable, { props: { columns, rows } })
    const button = wrapper.get('[data-sort="name"]')
    expect(button.attributes('data-sort-state')).toBe('none')
    expect(button.attributes('aria-sort')).toBeUndefined()
    expect(button.text()).toContain('Non trié')
    await button.trigger('click')
    expect(names(wrapper)).toEqual(['Devis', 'Factures', 'Relances'])
    expect(wrapper.get('[data-sort="name"]').attributes('data-sort-state')).toBe('ascending')
    await wrapper.get('[data-sort="name"]').trigger('click')
    expect(names(wrapper)).toEqual(['Relances', 'Factures', 'Devis'])
    expect(wrapper.get('[data-sort="name"]').attributes('data-sort-state')).toBe('descending')
  })

  it('tri numérique', async () => {
    const wrapper = mount(DataTable, { props: { columns, rows } })
    await wrapper.get('[data-sort="runs"]').trigger('click')
    expect(names(wrapper)).toEqual(['Devis', 'Relances', 'Factures'])
  })

  it('pas de bouton de tri sur une colonne non triable', () => {
    const wrapper = mount(DataTable, { props: { columns, rows } })
    expect(wrapper.find('[data-sort="owner"]').exists()).toBe(false)
  })

  it('ne modifie pas les lignes reçues', async () => {
    const wrapper = mount(DataTable, { props: { columns, rows } })
    await wrapper.get('[data-sort="name"]').trigger('click')
    expect(rows.map((r) => r.name)).toEqual(['Relances', 'Devis', 'Factures'])
  })
})

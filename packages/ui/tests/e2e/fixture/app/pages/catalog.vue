<script setup lang="ts">
type CpStatus = 'active' | 'paused' | 'error' | 'draft' | 'running'

const tab = ref('one')
const text = ref('Atelier Douala')
const select = ref<string | undefined>('erp')
const on = ref(true)
const navItems = [{ label: 'Accueil', icon: 'i-lucide-house', value: 'home' }]
const statuses: CpStatus[] = ['active', 'paused', 'error', 'draft', 'running']
const selectOptions = [
  { value: 'erp', label: 'Logiciel de gestion' },
  { value: 'crm', label: 'Fichier clients' },
]
const tabs = [
  { label: 'Premier', value: 'one' },
  { label: 'Deuxième', value: 'two' },
  { label: 'Troisième', value: 'three', badge: 2 },
]
const timeline = [
  { title: 'Demande reçue', time: '10:02', variant: 'success' as const },
  { title: 'Facture lue', time: '10:03', variant: 'default' as const },
  { title: 'E-mail en attente d’accord', time: '10:04', variant: 'warning' as const },
]
</script>

<template>
  <CpAppShell :nav-items="navItems" current-nav="home" user-name="Awa" data-page="catalog">
    <div class="mx-auto grid max-w-content-max grid-cols-1 gap-6 lg:grid-cols-2">
      <section class="flex flex-col gap-3" data-section="button">
        <h2 class="text-heading-2 text-cp-ink">Boutons</h2>
        <div class="flex flex-wrap gap-3">
          <CpButton label="Principal" />
          <CpButton variant="secondary" label="Secondaire" />
          <UButton color="neutral" variant="outline" label="Contour" />
          <CpButton variant="ghost" label="Discret" />
          <CpButton variant="danger" label="Supprimer" />
        </div>
      </section>

      <section class="flex flex-col gap-3" data-section="fields">
        <h2 class="text-heading-2 text-cp-ink">Champs</h2>
        <CpTextField v-model="text" label="Nom" help="Visible par votre équipe." />
        <CpSelect v-model="select" label="Système" :options="selectOptions" />
        <CpSwitch v-model="on" label="Demander mon accord avant d’envoyer" />
      </section>

      <section class="flex flex-col gap-3" data-section="status-badge">
        <h2 class="text-heading-2 text-cp-ink">Statuts</h2>
        <div class="flex flex-wrap gap-3">
          <CpStatusBadge v-for="s in statuses" :key="s" :status="s" />
        </div>
      </section>

      <section class="flex flex-col gap-3" data-section="alert">
        <h2 class="text-heading-2 text-cp-ink">Messages</h2>
        <CpAlert variant="info" title="Information" description="Une nouvelle version est disponible." />
        <CpAlert variant="success" title="Succès" description="Votre assistant est prêt." />
        <CpAlert variant="warning" title="Attention" description="Vos crédits baissent." />
        <CpAlert variant="danger" title="Erreur" description="La connexion a échoué." />
      </section>

      <section class="flex flex-col gap-3" data-section="tabs">
        <h2 class="text-heading-2 text-cp-ink">Onglets</h2>
        <CpTabs v-model="tab" :items="tabs" />
      </section>

      <section class="flex flex-col gap-3" data-section="risk-tag">
        <h2 class="text-heading-2 text-cp-ink">Niveaux de risque</h2>
        <div class="flex flex-wrap gap-4">
          <CpRiskTag level="low" />
          <CpRiskTag level="medium" />
          <CpRiskTag level="high" />
          <CpRiskTag level="critical" />
        </div>
      </section>

      <section class="flex flex-col gap-3" data-section="skeleton">
        <h2 class="text-heading-2 text-cp-ink">Chargement</h2>
        <CpSkeleton shape="line" :count="3" />
        <CpSkeleton shape="tile" />
      </section>

      <section class="flex flex-col gap-3" data-section="stat-tile">
        <h2 class="text-heading-2 text-cp-ink">Chiffre clé</h2>
        <CpStatTile label="Tâches terminées" value="248" trend="up" trend-value="+8 %" />
      </section>

      <section class="flex flex-col gap-3" data-section="credit-meter">
        <h2 class="text-heading-2 text-cp-ink">Crédits</h2>
        <CpCreditMeter :used="3000" :total="10000" label="Crédits du mois" />
        <CpCreditMeter :used="8200" :total="10000" label="Crédits du mois" />
        <CpCreditMeter :used="10000" :total="10000" label="Crédits du mois" />
      </section>

      <section class="flex flex-col gap-3" data-section="timeline">
        <h2 class="text-heading-2 text-cp-ink">Déroulé</h2>
        <CpTimeline :items="timeline" />
      </section>

      <section class="flex flex-col gap-3" data-section="secret-field">
        <h2 class="text-heading-2 text-cp-ink">Clé secrète</h2>
        <CpSecretField value="cp_live_exemple_0123456789" label="Clé d’accès" copyable warning />
      </section>

      <section class="flex flex-col gap-3" data-section="code-block">
        <h2 class="text-heading-2 text-cp-ink">Code</h2>
        <CpCodeBlock code='{ "assistant": "facturation" }' language="json" copyable />
      </section>

      <section class="flex flex-col gap-3" data-section="empty-state">
        <h2 class="text-heading-2 text-cp-ink">Zone vide</h2>
        <CpEmptyState
          title="Aucun assistant pour l’instant"
          description="Créez votre premier assistant pour commencer."
          :action="{ label: 'Créer un assistant', onClick: () => {} }"
        />
      </section>

      <section class="flex flex-col gap-3 lg:col-span-2" data-section="approval-card">
        <h2 class="text-heading-2 text-cp-ink">Validation</h2>
        <CpApprovalCard
          summary="L’assistant veut envoyer 12 relances par e-mail."
          :items="[{ label: 'Destinataires', value: '12 clients' }, { label: 'Montant total', value: '320 000 FCFA' }]"
          :risk="2"
          :parameters="{ count: 12 }"
        />
      </section>

      <section class="flex flex-col gap-3 lg:col-span-2" data-section="plan-gate">
        <h2 class="text-heading-2 text-cp-ink">Fonction hors formule</h2>
        <CpPlanGate
          feature="Assistants illimités"
          benefit="Créez autant d’assistants que nécessaire."
          plan-name="Business"
        />
      </section>
    </div>
  </CpAppShell>
</template>

import { type Component, defineComponent, h } from 'vue'

/**
 * Doublures minimales des composants Nuxt UI (D55 : tests unitaires sans Nuxt).
 * Elles exposent les props reçues en attributs `data-*` pour vérifier le câblage des wrappers Cp*.
 */

export const UButton = defineComponent({
  name: 'UButton',
  inheritAttrs: false,
  props: {
    label: String,
    icon: String,
    color: String,
    variant: String,
    size: String,
    disabled: Boolean,
    loading: Boolean,
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          ...attrs,
          'data-color': props.color,
          'data-variant': props.variant,
          'data-size': props.size,
          'data-icon': props.icon,
          disabled: props.disabled || props.loading,
        },
        slots.default ? slots.default() : props.label,
      )
  },
})

export const UIcon = defineComponent({
  name: 'UIcon',
  props: { name: String },
  setup(props, { attrs }) {
    return () => h('span', { ...attrs, 'data-icon': props.name })
  },
})

export const UFormField = defineComponent({
  name: 'UFormField',
  props: { label: String, help: String, error: String, required: Boolean },
  setup(props, { slots }) {
    return () =>
      h('div', { 'data-form-field': '' }, [
        h('label', { 'data-label': '' }, props.label),
        slots.default?.(),
        props.error
          ? h(
              'div',
              { 'data-error': '' },
              slots.error ? slots.error({ error: props.error }) : props.error,
            )
          : props.help
            ? h('div', { 'data-help': '' }, props.help)
            : null,
      ])
  },
})

export const UInput = defineComponent({
  name: 'UInput',
  props: {
    modelValue: [String, Number],
    type: String,
    placeholder: String,
    disabled: Boolean,
    required: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        value: props.modelValue,
        type: props.type,
        placeholder: props.placeholder,
        disabled: props.disabled,
        required: props.required,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLInputElement).value),
      })
  },
})

export const USelect = defineComponent({
  name: 'USelect',
  props: {
    modelValue: String,
    items: { type: Array as () => { value: string; label: string }[], default: () => [] },
    placeholder: String,
    disabled: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'select',
        {
          value: props.modelValue,
          disabled: props.disabled,
          'data-placeholder': props.placeholder,
          onChange: (event: Event) =>
            emit('update:modelValue', (event.target as HTMLSelectElement).value),
        },
        props.items.map((item) => h('option', { value: item.value }, item.label)),
      )
  },
})

export const USwitch = defineComponent({
  name: 'USwitch',
  props: { modelValue: Boolean, label: String, disabled: Boolean },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('div', [
        h('button', {
          type: 'button',
          role: 'switch',
          'aria-checked': String(props.modelValue),
          disabled: props.disabled,
          onClick: () => emit('update:modelValue', !props.modelValue),
        }),
        h('span', { 'data-label': '' }, props.label),
      ])
  },
})

export const USkeleton = defineComponent({
  name: 'USkeleton',
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => h('div', attrs)
  },
})

export const UTabs = defineComponent({
  name: 'UTabs',
  props: {
    modelValue: String,
    items: {
      type: Array as () => { label: string; value: string; badge?: number }[],
      default: () => [],
    },
    content: Boolean,
    variant: String,
    color: String,
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        { role: 'tablist', 'data-variant': props.variant, 'data-color': props.color },
        props.items.map((item) =>
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': String(item.value === props.modelValue),
              onClick: () => emit('update:modelValue', item.value),
            },
            [
              item.label,
              item.badge !== undefined ? h('span', { 'data-badge': '' }, String(item.badge)) : null,
            ],
          ),
        ),
      )
  },
})

export const UModal = defineComponent({
  name: 'UModal',
  props: {
    open: Boolean,
    title: String,
    description: String,
    dismissible: { type: Boolean, default: true },
  },
  emits: ['update:open'],
  setup(props, { slots, emit, attrs }) {
    return () =>
      props.open
        ? h(
            'div',
            {
              role: 'dialog',
              'aria-modal': 'true',
              'data-dismissible': String(props.dismissible),
              ...attrs,
            },
            [
              h('h2', { 'data-title': '' }, props.title),
              props.description ? h('p', { 'data-description': '' }, props.description) : null,
              slots.body?.(),
              h('div', { 'data-footer': '' }, slots.footer?.()),
              h('button', {
                type: 'button',
                'data-close': '',
                onClick: () => emit('update:open', false),
              }),
            ],
          )
        : null
  },
})

export const UTable = defineComponent({
  name: 'UTable',
  props: {
    data: { type: Array as () => Record<string, unknown>[], default: () => [] },
    columns: {
      type: Array as () => { accessorKey: string; header: string }[],
      default: () => [],
    },
  },
  setup(props, { slots }) {
    return () =>
      h('table', [
        h(
          'thead',
          h(
            'tr',
            props.columns.map((column) =>
              h(
                'th',
                { 'data-col': column.accessorKey },
                slots[`${column.accessorKey}-header`]?.({ column }) ?? column.header,
              ),
            ),
          ),
        ),
        h(
          'tbody',
          props.data.map((original) =>
            h(
              'tr',
              { 'data-row': '' },
              props.columns.map((column) =>
                h(
                  'td',
                  { 'data-cell': column.accessorKey },
                  slots[`${column.accessorKey}-cell`]?.({ row: { original } }),
                ),
              ),
            ),
          ),
        ),
      ])
  },
})

export const NuxtLink = defineComponent({
  name: 'NuxtLink',
  props: { to: String },
  setup(props, { slots, attrs }) {
    return () => h('a', { ...attrs, href: props.to }, slots.default?.())
  },
})

export const nuxtUiStubs: Record<string, Component> = {
  UButton,
  UIcon,
  UFormField,
  UInput,
  USelect,
  USwitch,
  USkeleton,
  UTabs,
  UModal,
  UTable,
  NuxtLink,
}

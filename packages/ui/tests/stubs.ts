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

export const nuxtUiStubs: Record<string, Component> = {
  UButton,
  UIcon,
  UFormField,
  UInput,
  USelect,
  USwitch,
  USkeleton,
  UTabs,
}

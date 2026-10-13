import { defineComponent, h } from 'vue'

/**
 * UButton de test : rend un lien (`to`) ou un bouton, expose `leading`, `loading`, `disabled`.
 * (La doublure du layer ne rend ni `to` ni le slot `leading`, nécessaires au bouton Google.)
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
    to: String,
    external: Boolean,
    block: Boolean,
    disabled: Boolean,
    loading: Boolean,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const content = [
        slots.leading?.(),
        props.icon ? h('span', { 'data-icon': props.icon }) : null,
        slots.default ? slots.default() : props.label,
      ]
      const common = {
        ...attrs,
        'data-color': props.color,
        'data-variant': props.variant,
        'data-size': props.size,
        'data-loading': props.loading || undefined,
      }
      if (props.to && !props.disabled && !props.loading) {
        return h('a', { ...common, href: props.to }, content)
      }
      return h(
        'button',
        { type: 'button', ...common, disabled: props.disabled || props.loading },
        content,
      )
    }
  },
})

export const USeparator = defineComponent({
  name: 'USeparator',
  props: { label: String },
  setup(props) {
    return () => h('div', { role: 'separator', 'data-separator': '' }, props.label)
  },
})

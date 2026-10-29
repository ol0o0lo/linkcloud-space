import type { ComponentResolver } from '@uni-helper/vite-plugin-uni-components'
import { kebabCase } from '@uni-helper/vite-plugin-uni-components'

export function TDesignResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve: (name: string) => {
      const tag = kebabCase(name)
      if (!tag.startsWith('t-'))
        return

      const component = tag.slice(2)
      const packageName = component.startsWith('chat-') || component === 'attachments' ? '@tdesign/uniapp-chat' : '@tdesign/uniapp'
      return {
        name,
        from: `${packageName}/${component}/${component}.vue`,
      }
    },
  }
}

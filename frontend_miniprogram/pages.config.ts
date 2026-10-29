import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'
import { productionSubpackageRoots } from './src/modules/subpackages'
import { tabBar } from './src/tabbar/config'

export default defineUniPages({
  globalStyle: {
    navigationStyle: 'default',
    navigationBarTitleText: '链云空间',
    navigationBarBackgroundColor: '#f8f8f8',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FFFFFF',
  },
  easycom: {
    autoscan: true,
    custom: {
      '^t-chat-(.*)': '@tdesign/uniapp-chat/chat-$1/chat-$1.vue',
      '^t-attachments': '@tdesign/uniapp-chat/attachments/attachments.vue',
      '^t-(.*)': '@tdesign/uniapp/$1/$1.vue',
      '^wd-(.*)': '@wot-ui/ui/components/wd-$1/wd-$1.vue',
    },
  },
  subPackages: productionSubpackageRoots.map(root => ({ root, pages: [] })),
  tabBar: tabBar as any,
})

import type { ListItemDataType, NoticeType, TagType } from './data.d';

const titles = ['Alipay', 'Angular', 'Ant Design', 'Ant Design Pro', 'Bootstrap', 'React', 'Vue', 'Webpack'];

const avatars = [
  'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
  'https://gw.alipayobjects.com/zos/rmsportal/zOsKZmFRdUtvpqCImOVY.png',
  'https://gw.alipayobjects.com/zos/rmsportal/dURIMkkrRFpPgTuzkwnB.png',
  'https://gw.alipayobjects.com/zos/rmsportal/sfjbOqnsXXJgNCjCzDBL.png',
  'https://gw.alipayobjects.com/zos/rmsportal/siCrBXXhmvTQGWPNLBow.png',
  'https://gw.alipayobjects.com/zos/rmsportal/kZzEzemZyKLKFsojXItE.png',
  'https://gw.alipayobjects.com/zos/rmsportal/ComBAopevLwENQdKWiIn.png',
  'https://gw.alipayobjects.com/zos/rmsportal/nxkuOJlFJuAUhzlMTCEe.png',
];

const covers = [
  'https://gw.alipayobjects.com/zos/rmsportal/uMfMFlvUuceEyPpotzlq.png',
  'https://gw.alipayobjects.com/zos/rmsportal/iZBVOIhGJiAnhplqjvZW.png',
  'https://gw.alipayobjects.com/zos/rmsportal/iXjVmWVHbCJAyqvDxdtx.png',
  'https://gw.alipayobjects.com/zos/rmsportal/gLaIAoVWTtLbBWZNYEMg.png',
];

const desc = [
  '那是一种内在的东西， 他们到达不了，也无法触及的',
  '希望是一个好东西，也许是最好的，好东西是不会消亡的',
  '生命就像一盒巧克力，结果往往出人意料',
  '城镇中有那么多的酒馆，她却偏偏走进了我的酒馆',
  '那时候我只会想自己想要什么，从不想自己拥有什么',
];

const memberAvatars = [
  'https://gw.alipayobjects.com/zos/rmsportal/ZiESqWwCXBRQoaPONSJe.png',
  'https://gw.alipayobjects.com/zos/rmsportal/tBOxZPlITHqwlGjsJWaF.png',
  'https://gw.alipayobjects.com/zos/rmsportal/sBxjgqiuHMGRkIjqlQCd.png',
];

const memberNames = ['曲丽丽', '王昭君', '董娜娜'];

const members = memberAvatars.map((avatar, i) => ({
  avatar,
  name: memberNames[i],
  id: `member${i + 1}`,
}));

export const buildMockListData = (count: number): ListItemDataType[] => {
  const list: ListItemDataType[] = [];
  for (let i = 0; i < count; i += 1) {
    list.push({
      id: `fake-list-${i}`,
      owner: ['Serati Ma', '曲丽丽', '林东东', '周星星'][i % 4],
      title: titles[i % titles.length],
      avatar: avatars[i % avatars.length],
      cover: Math.floor(i / 4) % 2 === 0 ? covers[i % covers.length] : covers[3 - (i % covers.length)],
      status: ['active', 'exception', 'normal', 'success'][i % 4] as ListItemDataType['status'],
      percent: Math.ceil(Math.random() * 50) + 50,
      logo: avatars[i % 8],
      href: 'https://ant.design',
      updatedAt: Date.now() - 1000 * 60 * 60 * 2 * i,
      createdAt: Date.now() - 1000 * 60 * 60 * 2 * i,
      subDescription: desc[i % desc.length],
      description: '在中台产品的研发过程中，会出现不同的设计规范和实现方式。',
      activeUser: Math.ceil(Math.random() * 100000) + 100000,
      newUser: Math.ceil(Math.random() * 1000) + 1000,
      star: Math.ceil(Math.random() * 100) + 100,
      like: Math.ceil(Math.random() * 100) + 100,
      message: Math.ceil(Math.random() * 10) + 10,
      content: '个人中心示例内容，来自本地 mock 数据。',
      members,
    });
  }
  return list;
};

export type MockCurrentUser = {
  avatar: string;
  name: string;
  signature: string;
  title: string;
  group: string;
  geographic?: {
    province: { label: string };
    city: { label: string };
  };
  tags?: TagType[];
  notice?: NoticeType[];
};

export const buildMockCurrentUser = (item?: ListItemDataType): MockCurrentUser | undefined => {
  if (!item) {
    return undefined;
  }

  return {
    avatar: item.avatar,
    name: item.owner,
    signature: item.subDescription,
    title: item.title,
    group: item.description,
    tags: [
      { key: 'status', label: `状态：${item.status}` },
      { key: 'percent', label: `完成度：${item.percent}%` },
      { key: 'star', label: `Star：${item.star}` },
      { key: 'like', label: `Like：${item.like}` },
    ],
    notice: item.members?.map((member) => ({
      id: member.id,
      title: member.name,
      logo: member.avatar,
      description: member.name,
      updatedAt: '',
      member: member.name,
      href: item.href,
      memberLink: item.href,
    })),
  };
};

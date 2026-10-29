/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 分享公开房源卡片 POST /api/house/messaging/organizations/${param0}/conversations/${param1}/house/ */
export function houseMessagingOrganizationsOrganizationSlugConversationsConversationIdHouseUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.HouseMessagingOrganizationsOrganizationSlugConversationsConversationIdHouseUsingPostParams;
  body: API.HouseMessageIn;
  options?: CustomRequestOptions_;
}) {
  const {
    organization_slug: param0,
    conversation_id: param1,
    ...queryParams
  } = params;

  return request<API.MessagingMessageOut>(
    `/api/house/messaging/organizations/${param0}/conversations/${param1}/house/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

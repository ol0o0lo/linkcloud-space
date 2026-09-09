/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取当前组织导航能力 GET /api/access/navigation/ */
export function accessNavigationUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.NavigationAccessCapabilitiesOut>(
    '/api/access/navigation/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

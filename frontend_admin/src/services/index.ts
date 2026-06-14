import allauth from './allauth';
import manual from './manual';
import openapi from './openapi';

export { default as allauth } from './allauth';
export { default as manual } from './manual';
export { default as openapi } from './openapi';
export * as manualApi from './manual/api';
export * as manualLogin from './manual/login';
export * as manualOrganization from './manual/organization';

export default {
  allauth,
  manual,
  openapi,
};

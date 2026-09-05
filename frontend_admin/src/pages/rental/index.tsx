import { Navigate } from '@umijs/max';
import { DEFAULT_PROPERTY_LIST_PATH } from '@/utils/adminRouting';

const PropertyRentalIndex = () => (
  <Navigate to={DEFAULT_PROPERTY_LIST_PATH} replace />
);

export default PropertyRentalIndex;

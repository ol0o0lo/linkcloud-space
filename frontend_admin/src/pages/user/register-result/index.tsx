import { Navigate, useLocation } from '@umijs/max';
import React from 'react';

const RegisterResult: React.FC<Record<string, unknown>> = () => {
  const { search } = useLocation();

  return <Navigate replace to={`/user/register${search}`} />;
};
export default RegisterResult;

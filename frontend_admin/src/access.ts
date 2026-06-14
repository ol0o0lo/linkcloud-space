/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState: { currentUser?: API.MeOut } | undefined,
) {
  const { currentUser } = initialState ?? {};
  return {
    canAdmin: Boolean(currentUser?.is_staff || currentUser?.is_superuser),
  };
}

declare namespace AllauthAPI {
  type AccessToken = string;

  type AccountConfiguration = {
    login_methods?: ("email" | "username")[];
    is_open_for_signup: boolean;
    email_verification_by_code_enabled: boolean;
    login_by_code_enabled: boolean;
    password_reset_by_code_enabled?: boolean;
  };

  type AddWebAuthnAuthenticator = {
    name?: string;
    credential: WebAuthnCredential;
  };

  type Authenticated = {
    user: User;
    /** A list of methods used to authenticate.
     */
    methods: AuthenticationMethod[];
  };

  type AuthenticatedMeta =
    // #/components/schemas/BaseAuthenticationMeta
    BaseAuthenticationMeta & {
      is_authenticated: true;
    };

  type AuthenticatedResponse = {
    status: Record<string, any>;
    data: Record<string, any>;
    meta: AuthenticationMeta;
  };

  type AuthenticateWebAuthn = {
    credential: WebAuthnCredential;
  };

  type AuthenticationMeta =
    // #/components/schemas/BaseAuthenticationMeta
    BaseAuthenticationMeta & {
      is_authenticated: boolean;
    };

  type AuthenticationMethod = Record<string, any>;

  type AuthenticationResponse = {
    status: 401;
    data: { flows: Flow[] };
    meta: AuthenticationMeta;
  };

  type AuthenticatorCode = string;

  type AuthenticatorID = integer;

  type AuthenticatorList = Record<string, any>;

  type AuthenticatorType = "recovery_codes" | "totp" | "webauthn";

  type BaseAuthenticationMeta = {
    /** The session token (`app` clients only).
     */
    session_token?: string;
    /** The access token (`app` clients only).
     */
    access_token?: string;
  };

  type BaseAuthenticator = {
    last_used_at: OptionalTimestamp;
    created_at: Timestamp;
  };

  type BaseSignup = {
    email?: Email;
    phone?: Phone1;
    username?: Username;
  };

  type ChangePassword = {
    current_password?: Password;
    /** The current password.
     */
    new_password: string;
  };

  type ClientID = string;

  type Code = string;

  type ConfigurationResponse = {
    data: {
      account: AccountConfiguration;
      socialaccount?: SocialAccountConfiguration;
      mfa?: MFAConfiguration;
      usersessions?: UserSessionsConfiguration;
    };
    status: Record<string, any>;
  };

  type ConfirmLoginCode = {
    code: Code;
  };

  type ConflictResponse = {
    status: 409;
  };

  type deleteBrowserV1AccountAuthenticatorsTotpParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type deleteBrowserV1AccountAuthenticatorsWebauthnParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type deleteBrowserV1AccountEmailParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type deleteBrowserV1AccountProvidersParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type deleteBrowserV1AuthSessionParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type deleteBrowserV1AuthSessionsParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type DeleteWebAuthn = {
    /** The IDs of the authenticator that are to be deleted.
     */
    authenticators: AuthenticatorID[];
  };

  type Email = {
    email: Email;
  };

  type EmailAddress = {
    email: Email;
    primary: boolean;
    verified: boolean;
  };

  type EmailVerificationInfo = {
    status: Record<string, any>;
    data: { email: Email; user: User };
    meta: { is_authenticating: boolean };
  };

  type EndSessions = {
    /** The IDs of the sessions that are to be ended.
     */
    sessions: number[];
  };

  type ErrorResponse = {
    status?: 400;
    errors?: { code: string; param?: string; message: string }[];
  };

  type Flow = {
    id:
      | "login"
      | "login_by_code"
      | "mfa_authenticate"
      | "mfa_reauthenticate"
      | "provider_redirect"
      | "provider_signup"
      | "provider_token"
      | "reauthenticate"
      | "signup"
      | "verify_email"
      | "verify_phone";
    provider?: Provider;
    is_pending?: true;
    /** Matches `settings.MFA_SUPPORTED_TYPES`. */
    types?: AuthenticatorType[];
  };

  type ForbiddenResponse = {
    status: 403;
  };

  type getBrowserV1AccountAuthenticatorsParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AccountAuthenticatorsRecoveryCodesParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AccountAuthenticatorsTotpParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AccountAuthenticatorsWebauthnParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
    /** When present (regardless of its value), enables passwordless sign-in via a WebAuthn credential (Passkey),
but may enforce additional multi-factor authentication (MFA) requirements. Omit the parameter to disable.
 */
    passwordless?: boolean;
  };

  type getBrowserV1AccountEmailParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AccountPhoneParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AccountProvidersParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AuthEmailVerifyParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AuthPasswordResetParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AuthProviderSignupParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AuthSessionParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AuthSessionsParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AuthWebauthnAuthenticateParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AuthWebauthnLoginParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AuthWebauthnReauthenticateParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1AuthWebauthnSignupParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type getBrowserV1ConfigParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type Login = {
    password: Password;
  } & {};

  type LoginWebAuthn = {
    credential: WebAuthnCredential;
  };

  type MarkPrimaryEmail = {
    /** An email address.
     */
    email: string;
    /** Primary flag.
     */
    primary: true;
  };

  type MFAAuthenticate = {
    code: AuthenticatorCode;
  };

  type MFAConfiguration = {
    /** Matches `settings.MFA_SUPPORTED_TYPES`.
     */
    supported_types: AuthenticatorType[];
  };

  type MFATrust = {
    trust: boolean;
  };

  type OptionalTimestamp = Record<string, any>;

  type PasskeySignup =
    // #/components/schemas/BaseSignup
    BaseSignup;

  type Password = string;

  type patchBrowserV1AccountEmailParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type Phone = {
    phone: string;
  };

  type Phone1 = string;

  type PhoneNumber = {
    phone: string;
    verified: boolean;
  };

  type PhoneNumberChangeResponse = {
    status: StatusAccepted;
    data: PhoneNumber[];
  };

  type PhoneNumbersResponse = {
    status: Record<string, any>;
    data: PhoneNumber[];
  };

  type postAppV1TokensRefreshParams = {
    "X-Session-Token"?: string;
  };

  type postBrowserV1AccountAuthenticatorsRecoveryCodesParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AccountAuthenticatorsTotpParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AccountAuthenticatorsWebauthnParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AccountEmailParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AccountPasswordChangeParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AccountPhoneParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthCodeConfirmParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthCodeRequestParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthCodeResendParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthEmailVerifyParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthEmailVerifyResendParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthLoginParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthPasswordRequestParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthPasswordResetParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthPhoneVerifyParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthPhoneVerifyResendParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthProviderRedirectParams = {
    "X-Session-Token"?: string;
  };

  type postBrowserV1AuthProviderSignupParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthProviderTokenParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthReauthenticateParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthSignupParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthTwofaAuthenticateParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthTwofaReauthenticateParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthTwofaTrustParams = {
    "X-Session-Token"?: string;
  };

  type postBrowserV1AuthWebauthnAuthenticateParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthWebauthnLoginParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthWebauthnReauthenticateParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type postBrowserV1AuthWebauthnSignupParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type Process = "login" | "connect";

  type Provider = {
    /** The provider ID.
     */
    id: string;
    /** The name of the provider.
     */
    name: string;
    /** The client ID (in case of OAuth2 or OpenID Connect based providers)
     */
    client_id?: string;
    /** The OIDC discovery or well-known URL (in case of OAuth2 or OpenID Connect based providers)
     */
    openid_configuration_url?: string;
    /** The authentication flows the provider integration supports.
     */
    flows: ("provider_redirect" | "provider_token")[];
  };

  type ProviderAccount = {
    provider: ProviderID;
    account: ProviderAccountID;
  };

  type ProviderAccount2 = {
    uid: ProviderAccountID;
    /** A name derived from the third-party provider account data.
     */
    display: string;
    provider: Provider;
  };

  type ProviderAccountID = string;

  type ProviderID = string;

  type ProviderList = Provider[];

  type ProviderSignup =
    // #/components/schemas/BaseSignup
    BaseSignup;

  type ProviderToken = {
    provider: ProviderID;
    process: Process;
    /** The token.
     */
    token: { client_id: ClientID; id_token?: string; access_token?: string };
  };

  type putBrowserV1AccountAuthenticatorsWebauthnParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type putBrowserV1AccountEmailParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type putBrowserV1AuthWebauthnSignupParams = {
    "X-Session-Token"?: string;
    /** The type of client accessing the API. */
    client: "app" | "browser";
  };

  type Reauthenticate = {
    password: Password;
  };

  type ReauthenticateWebAuthn = {
    credential: WebAuthnCredential;
  };

  type ReauthenticationRequired = {
    flows: Flow[];
    user: User;
    /** A list of methods used to authenticate.
     */
    methods: AuthenticationMethod[];
  };

  type ReauthenticationResponse = {
    status: 401;
    data: ReauthenticationRequired;
    meta: AuthenticatedMeta;
  };

  type RecoveryCodesAuthenticator =
    // #/components/schemas/BaseAuthenticator
    BaseAuthenticator & {
      /** The authenticator type.
       */
      type: "recovery_codes";
      /** The total number of recovery codes that initially were available.
       */
      total_code_count: number;
      /** The number of recovery codes that are unused.
       */
      unused_code_count: number;
    };

  type RefreshToken = {
    refresh_token: RefreshToken;
  };

  type RequestLoginCode = Record<string, any>;

  type RequestPassword = {
    email: Email;
  };

  type ResetPassword = {
    /** The password reset key */
    key: string;
    password: Password;
  };

  type SensitiveRecoveryCodesAuthenticator =
    // #/components/schemas/RecoveryCodesAuthenticator
    RecoveryCodesAuthenticator & {
      /** The list of unused codes.
       */
      unused_codes: AuthenticatorCode[];
    };

  type Session = {
    user_agent: string;
    ip: string;
    created_at: Timestamp;
    is_current: boolean;
    id: number;
    last_seen_at?: Timestamp;
  };

  type SessionGoneResponse = {
    status: 410;
    data: Record<string, any>;
    meta: AuthenticationMeta;
  };

  type SetupTOTP = {
    code: AuthenticatorCode;
  };

  type Signup =
    // #/components/schemas/BaseSignup
    BaseSignup & {
      password: Password;
    };

  type SocialAccountConfiguration = {
    providers: ProviderList;
  };

  type StatusAccepted = 202;

  type StatusOK = 200;

  type Timestamp = number;

  type TOTPAuthenticator =
    // #/components/schemas/BaseAuthenticator
    BaseAuthenticator & {
      type: "totp";
    };

  type UpdateWebAuthn = {
    id?: AuthenticatorID;
    name?: string;
  };

  type User = {
    /** The user ID.
     */
    id?: number | string;
    /** The display name for the user.
     */
    display?: string;
    /** Whether or not the account has a password set.
     */
    has_usable_password?: boolean;
    email?: Email;
    username?: Username;
  };

  type Username = string;

  type UserSessionsConfiguration = {
    /** Matches `settings.USERSESSIONS_TRACK_ACTIVITY`.
     */
    track_activity: boolean;
  };

  type VerifyEmail = {
    /** The email verification key */
    key: string;
  };

  type VerifyPhone = {
    /** The phone verification code */
    code: string;
  };

  type WebAuthnAuthenticator =
    // #/components/schemas/BaseAuthenticator
    BaseAuthenticator & {
      type: "webauthn";
      id: AuthenticatorID;
      name: string;
      /** Whether or not this authenticator represents a passkey. Absent if it is not specified.
       */
      is_passwordless?: boolean;
    };

  type WebAuthnCredential = {};

  type WebAuthnCredentialCreationOptions = {
    creation_options: Record<string, any>;
  };

  type WebAuthnCredentialRequestOptions = {
    request_options: Record<string, any>;
  };
}

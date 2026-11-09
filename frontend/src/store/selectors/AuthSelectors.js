export const isAuthenticated = (state) => {
    // Check for JWT access token (Django format) instead of idToken (Firebase format)
    if (state.auth.auth.access) return true;
    return false;
};

/**
 * Auth Feature - Barrel Export
 *
 * This feature handles user authentication including login, signup,
 * and auth context management.
 */

// Components
export { LoginModal } from './components/LoginModal';
export { SignupModal } from './components/SignupModal';

// Context
export { AuthProvider, useAuth } from './contexts/AuthContext';

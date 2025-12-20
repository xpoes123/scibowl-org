import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/contexts/AuthContext';
import { authAPI } from '../../../core/api/api';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';

export const ProfilePage = () => {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    bio: '',
    school: '',
    grade_level: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/practice');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        bio: user.bio || '',
        school: user.school || '',
        grade_level: user.grade_level?.toString() || '',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      await authAPI.updateProfile({
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        bio: formData.bio,
        school: formData.school,
        grade_level: formData.grade_level ? parseInt(formData.grade_level) : undefined,
      });

      // Refresh user data in the global context
      await refreshUser();
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update profile'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        bio: user.bio || '',
        school: user.school || '',
        grade_level: user.grade_level?.toString() || '',
      });
    }
    setIsEditing(false);
    setMessage(null);
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <div className="text-slate-300 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Hero Section with Avatar and Header */}
      <div className="bg-gradient-to-r from-purple-900/50 via-slate-800/50 to-purple-900/50 rounded-xl shadow-2xl border border-purple-500/30 p-8 mb-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <Avatar username={user.username} size={140} className="ring-4 ring-purple-500/50 shadow-lg" />
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-300 via-purple-200 to-purple-400 bg-clip-text text-transparent mb-2">
              {user.username}
            </h1>
            <p className="text-slate-400 text-lg mb-4">
              {user.email}
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <div className="px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg">
                <span className="text-purple-300 font-semibold">{user.school || 'No School Set'}</span>
              </div>
              <div className="px-4 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg">
                <span className="text-purple-300 font-semibold">Grade {user.grade_level || 'N/A'}</span>
              </div>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-600 transition-all shadow-lg hover:shadow-purple-500/50"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-purple-900/40 to-slate-800/40 border border-purple-500/30 rounded-xl p-6 shadow-lg hover:shadow-purple-500/20 transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-300 font-semibold">Questions Answered</h3>
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-purple-300 bg-clip-text text-transparent">
            {user.total_questions_answered}
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-900/40 to-slate-800/40 border border-green-500/30 rounded-xl p-6 shadow-lg hover:shadow-green-500/20 transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-300 font-semibold">Correct Answers</h3>
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-green-300 bg-clip-text text-transparent">
            {user.correct_answers}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-900/40 to-slate-800/40 border border-blue-500/30 rounded-xl p-6 shadow-lg hover:shadow-blue-500/20 transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-300 font-semibold">Accuracy</h3>
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
            {user.accuracy.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Placeholder sections for future features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Rank & Level Section */}
        <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-slate-200 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Rank
          </h2>
          <div className="text-center py-8">
            <p className="text-slate-400 text-lg">Coming Soon!</p>
            <p className="text-slate-500 mt-2">Compete and climb the ranks</p>
          </div>
        </div>

        {/* Achievements Section */}
        <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-slate-200 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Achievements
          </h2>
          <div className="text-center py-8">
            <p className="text-slate-400 text-lg">Coming Soon!</p>
            <p className="text-slate-500 mt-2">Unlock badges and rewards</p>
          </div>
        </div>
      </div>

      {/* Multiplayer Stats Section */}
      <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-6 shadow-lg mb-6">
        <h2 className="text-2xl font-bold text-slate-200 mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Multiplayer Statistics
        </h2>
        <div className="text-center py-8">
          <p className="text-slate-400 text-lg">Coming Soon!</p>
          <p className="text-slate-500 mt-2">Track your wins, losses, and competitive stats</p>
        </div>
      </div>

      {/* Profile Information Form */}
      <div className="bg-slate-800/50 rounded-xl shadow-xl border border-purple-500/30 p-8">
        <h2 className="text-2xl font-bold text-slate-200 mb-6">Profile Information</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username (read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Username
            </label>
            <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded text-slate-400">
              {user.username}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={!isEditing}
              className={`w-full px-4 py-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${
                isEditing
                  ? 'bg-slate-900 border border-purple-500/30'
                  : 'bg-slate-900/50 border border-slate-700'
              }`}
            />
          </div>

          {/* First Name */}
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-slate-300 mb-2">
              First Name
            </label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              disabled={!isEditing}
              className={`w-full px-4 py-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${
                isEditing
                  ? 'bg-slate-900 border border-purple-500/30'
                  : 'bg-slate-900/50 border border-slate-700'
              }`}
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-slate-300 mb-2">
              Last Name
            </label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              disabled={!isEditing}
              className={`w-full px-4 py-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${
                isEditing
                  ? 'bg-slate-900 border border-purple-500/30'
                  : 'bg-slate-900/50 border border-slate-700'
              }`}
            />
          </div>

          {/* School */}
          <div>
            <label htmlFor="school" className="block text-sm font-medium text-slate-300 mb-2">
              School
            </label>
            <input
              type="text"
              id="school"
              name="school"
              value={formData.school}
              onChange={handleChange}
              disabled={!isEditing}
              className={`w-full px-4 py-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${
                isEditing
                  ? 'bg-slate-900 border border-purple-500/30'
                  : 'bg-slate-900/50 border border-slate-700'
              }`}
            />
          </div>

          {/* Grade Level */}
          <div>
            <label htmlFor="grade_level" className="block text-sm font-medium text-slate-300 mb-2">
              Grade Level
            </label>
            <input
              type="number"
              id="grade_level"
              name="grade_level"
              value={formData.grade_level}
              onChange={handleChange}
              disabled={!isEditing}
              min="1"
              max="12"
              className={`w-full px-4 py-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${
                isEditing
                  ? 'bg-slate-900 border border-purple-500/30'
                  : 'bg-slate-900/50 border border-slate-700'
              }`}
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-slate-300 mb-2">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              disabled={!isEditing}
              rows={4}
              className={`w-full px-4 py-2 rounded text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${
                isEditing
                  ? 'bg-slate-900 border border-purple-500/30'
                  : 'bg-slate-900/50 border border-slate-700'
              }`}
            />
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium rounded hover:from-purple-700 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

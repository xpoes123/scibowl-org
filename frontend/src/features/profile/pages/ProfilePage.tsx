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
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="bg-slate-800 rounded-lg shadow-xl border border-purple-500/30 p-8">
        {/* Avatar and Header */}
        <div className="flex items-center gap-6 mb-8">
          <Avatar username={user.username} size={120} className="ring-4 ring-purple-500/30" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">
              {user.username}
            </h1>
            <p className="text-slate-400 mt-1">
              {user.email}
            </p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium rounded hover:from-purple-700 hover:to-purple-600 transition-all"
            >
              Edit Profile
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-6 px-4 py-3 rounded ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

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

          {/* Stats (read-only) */}
          <div className="border-t border-slate-700 pt-6">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/50 border border-slate-700 rounded p-4">
                <div className="text-slate-400 text-sm mb-1">Questions Answered</div>
                <div className="text-2xl font-bold text-purple-400">{user.total_questions_answered}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-700 rounded p-4">
                <div className="text-slate-400 text-sm mb-1">Correct Answers</div>
                <div className="text-2xl font-bold text-green-400">{user.correct_answers}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-700 rounded p-4">
                <div className="text-slate-400 text-sm mb-1">Accuracy</div>
                <div className="text-2xl font-bold text-blue-400">{user.accuracy.toFixed(1)}%</div>
              </div>
            </div>
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

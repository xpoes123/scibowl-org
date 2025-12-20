import { useState } from 'react';
import { Avatar } from '../components/Avatar';

export const AvatarPreviewPage = () => {
  const [searchUsername, setSearchUsername] = useState('');
  const [searchedUsername, setSearchedUsername] = useState('');

  // Sample usernames using advanced science terminology
  const sampleUsernames = [
  // Group 1
  'Voronoi', 'Manifold', 'Noether', 'Favorskii', 'Hamiltonian', 'Madelung',

  // Group 2
  'jahn_teller', 'Auger', 'Azeotrope', 'Spinodal', 'Atkins', 'Boltzmann',

  // Group 3
  'Apoptosis', 'Aquaporin', 'Tryptophan', 'Plasmodium', 'Campbell', 'Operon',

  // Group 4
  'Isostasy', 'Lithosphere', 'Permafrost', 'Epidote', 'Cryosphere', 'Asthenosphere',

  // Group 5
  'Redshift', 'Pulsar', 'Exoplanet', 'Marshak', 'Supernova', 'Magnetosphere',

  // Group 6
  'Klein', 'Fourier', 'Halliday', 'Invariant', 'Dispersion', 'Lagrangian',

  // Group 7
  'Lexington', 'NoHo', 'Mira_Loma', 'DOE', 'NSBA', 'NEG',

  // Group 8
  'Bingel', 'Zeolite', 'Clathrate', 'Morphogen', 'Ribosome', 'Epigenetic'
];
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchUsername.trim()) {
      setSearchedUsername(searchUsername.trim());
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent mb-2">
          Avatar Lookup
        </h1>
        <p className="text-slate-400">
          Search for any username to see their unique avatar
        </p>
      </div>

      {/* Search Section */}
      <div className="mb-12 bg-slate-800 rounded-lg border border-purple-500/30 p-8">
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">Search Avatar by Username</h2>
        <form onSubmit={handleSearch} className="flex gap-4 mb-6">
          <input
            type="text"
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            placeholder="Enter username..."
            className="flex-1 px-4 py-3 bg-slate-900 border border-purple-500/30 rounded text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium rounded hover:from-purple-700 hover:to-purple-600 transition-all"
          >
            Search
          </button>
        </form>

        {searchedUsername && (
          <div className="bg-slate-900/50 rounded-lg p-6 border border-purple-500/20">
            <div className="flex items-center gap-6">
              <Avatar username={searchedUsername} size={120} className="ring-4 ring-purple-500/30" />
              <div>
                <h3 className="text-2xl font-bold text-purple-400 mb-1">{searchedUsername}</h3>
                <p className="text-slate-400 text-sm mb-3">
                  This avatar is deterministically generated from the username
                </p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Avatar username={searchedUsername} size={40} />
                    <span className="text-xs text-slate-400">40px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar username={searchedUsername} size={64} />
                    <span className="text-xs text-slate-400">64px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar username={searchedUsername} size={80} />
                    <span className="text-xs text-slate-400">80px</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sample Usernames Gallery */}
      <div className="bg-slate-800 rounded-lg border border-purple-500/30 p-6">
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">Sample Usernames</h2>
        <p className="text-slate-400 mb-6 text-sm">
          Click any username to see it in the search above
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {sampleUsernames.map((username) => (
            <button
              key={username}
              onClick={() => {
                setSearchUsername(username);
                setSearchedUsername(username);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-slate-700/50 transition-all group"
            >
              <Avatar username={username} size={80} className="ring-2 ring-purple-500/20 group-hover:ring-purple-500 transition-all" />
              <span className="text-sm text-slate-300 group-hover:text-purple-400 transition-colors">{username}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

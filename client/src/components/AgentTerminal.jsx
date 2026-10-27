import { useState } from 'react';
import { Camera, Mic, Upload, MapPin, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { inspectVessel, transcribeAudio } from '../utils/api';

export default function AgentTerminal() {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [audio, setAudio] = useState(null);
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [audioResult, setAudioResult] = useState(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAudioChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAudio(file);
    }
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(`${position.coords.latitude}, ${position.coords.longitude}`);
        },
        (error) => {
          console.error('Erreur géolocalisation:', error);
        }
      );
    }
  };

  const handleInspect = async () => {
    if (!photo) {
      alert('Veuillez sélectionner une photo de l\'embarcation');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', photo);
      formData.append('vessel_name', 'Embarcation inspectée');
      formData.append('vessel_type', 'pirogue');
      formData.append('location', location || 'Non précisée');
      formData.append('declared_capacity', '10');

      const data = await inspectVessel(formData);
      setResult(data);
    } catch (error) {
      console.error('Erreur inspection:', error);
      alert('Erreur lors de l\'inspection');
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!audio) {
      alert('Veuillez sélectionner un fichier audio');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', audio);
      formData.append('location_text', location || 'Non précisée');

      const data = await transcribeAudio(formData);
      setAudioResult(data);
    } catch (error) {
      console.error('Erreur transcription:', error);
      alert('Erreur lors de la transcription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Camera className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Terminal Agent - Inspection</h2>
      </div>

      {/* Module Inspect */}
      <div className="mb-8 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2 text-gray-900 dark:text-white">
          <Camera className="h-5 w-5" />
          <span>Module Inspection Photo</span>
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Photo de l'embarcation
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {photoPreview && (
            <div className="mt-4">
              <img src={photoPreview} alt="Aperçu" className="w-full h-48 object-cover rounded-lg" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Géolocalisation
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Coordonnées ou lieu"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button
                onClick={getLocation}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center space-x-2"
              >
                <MapPin className="h-4 w-4" />
                <span>GPS</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleInspect}
            disabled={loading || !photo}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{loading ? 'Analyse en cours...' : 'Lancer l\'inspection'}</span>
          </button>

          {result && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-800 dark:text-green-400">Inspection terminée</span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                Inspection ID: {result.inspection_id}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Risque: {result.risk?.level || 'N/A'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Module Audio */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2 text-gray-900 dark:text-white">
          <Mic className="h-5 w-5" />
          <span>Module Alerte Vocale</span>
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fichier audio d'alerte (appel de détresse)
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
            />
          </div>

          <button
            onClick={handleTranscribe}
            disabled={loading || !audio}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            <span>{loading ? 'Transcription...' : 'Transcrire l\'alerte'}</span>
          </button>

          {audioResult && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-800 dark:text-red-400">Alerte transcrite</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                {audioResult.transcription?.text || 'Transcription disponible'}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Langue: {audioResult.transcription?.language || 'N/A'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <p className="text-xs text-yellow-800 dark:text-yellow-400 text-center">
          ⚠️ L'IA propose, l'humain décide. Aucun refus automatique.
        </p>
      </div>
    </div>
  );
}

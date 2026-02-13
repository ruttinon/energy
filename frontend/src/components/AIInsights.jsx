import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Activity, Zap } from 'lucide-react';

const AIInsights = ({ projectId, apiBase }) => {
  const [insights, setInsights] = useState({
    analysis: null,
    predictions: null,
    anomalies: [],
    recommendations: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    if (projectId) {
      loadAllInsights();
    }
  }, [projectId]);

  const loadAllInsights = async () => {
    setIsLoading(true);
    try {
      const [analysis, predictions, anomalies, recommendations] = await Promise.all([
        loadAnalysis(),
        loadPredictions(),
        loadAnomalies(),
        loadRecommendations()
      ]);

      setInsights({
        analysis,
        predictions,
        anomalies: anomalies.anomalies || [],
        recommendations: recommendations.recommendations || []
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalysis = async () => {
    try {
      const response = await fetch(`${apiBase}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, days: 7 })
      });
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const loadPredictions = async () => {
    try {
      const response = await fetch(`${apiBase}/api/ai/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, hours_ahead: 24 })
      });
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const loadAnomalies = async () => {
    try {
      const response = await fetch(`${apiBase}/api/ai/anomalies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, hours: 24 })
      });
      return await response.json();
    } catch (error) {
      return { anomalies: [] };
    }
  };

  const loadRecommendations = async () => {
    try {
      const response = await fetch(`${apiBase}/api/ai/recommendations/${projectId}`);
      return await response.json();
    } catch (error) {
      return { recommendations: [] };
    }
  };

  const formatPower = (kw) => {
    return `${kw.toFixed(2)} kW`;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">AI Insights</h2>
        </div>
        <div className="flex items-center space-x-4">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString('th-TH')}
            </span>
          )}
          <button
            onClick={loadAllInsights}
            className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Analysis Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="font-medium text-gray-900">Analysis</h3>
            </div>
          </div>
          {insights.analysis ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 line-clamp-3">
                {insights.analysis.analysis?.substring(0, 150)}...
              </p>
              <div className="text-xs text-gray-500">
                {insights.analysis.data_points} data points
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No analysis available</div>
          )}
        </div>

        {/* Predictions Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <h3 className="font-medium text-gray-900">Predictions</h3>
            </div>
          </div>
          {insights.predictions?.predictions?.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm">
                <div className="font-medium text-gray-900">Next 24h</div>
                <div className="text-gray-600">
                  Peak: {formatPower(Math.max(...insights.predictions.predictions.map(p => p.predicted_kw)))}
                </div>
                <div className="text-gray-600">
                  Avg: {formatPower(
                    insights.predictions.predictions.reduce((sum, p) => sum + p.predicted_kw, 0) / 
                    insights.predictions.predictions.length
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Confidence: {insights.predictions.confidence}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No predictions available</div>
          )}
        </div>

        {/* Anomalies Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h3 className="font-medium text-gray-900">Anomalies</h3>
            </div>
            {insights.anomalies.length > 0 && (
              <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">
                {insights.anomalies.length}
              </span>
            )}
          </div>
          {insights.anomalies.length > 0 ? (
            <div className="space-y-2">
              {insights.anomalies.slice(0, 2).map((anomaly, index) => (
                <div key={index} className={`text-xs p-2 rounded border ${getSeverityColor(anomaly.severity)}`}>
                  <div className="font-medium">{anomaly.device}</div>
                  <div>{formatPower(anomaly.value)}</div>
                </div>
              ))}
              {insights.anomalies.length > 2 && (
                <div className="text-xs text-gray-500">
                  +{insights.anomalies.length - 2} more
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-green-600">No anomalies detected</div>
          )}
        </div>

        {/* Recommendations Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 text-yellow-600" />
              <h3 className="font-medium text-gray-900">Tips</h3>
            </div>
          </div>
          {insights.recommendations.length > 0 ? (
            <div className="space-y-2">
              {insights.recommendations.slice(0, 2).map((rec, index) => (
                <div key={index} className="text-xs text-gray-600 leading-relaxed">
                  • {rec.substring(0, 60)}...
                </div>
              ))}
              {insights.recommendations.length > 2 && (
                <div className="text-xs text-gray-500">
                  +{insights.recommendations.length - 2} more tips
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No recommendations available</div>
          )}
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Detailed Analysis */}
        {insights.analysis && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>Detailed Analysis</span>
            </h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">
                {insights.analysis.analysis}
              </p>
            </div>
          </div>
        )}

        {/* Detailed Recommendations */}
        {insights.recommendations.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <span>Energy Saving Recommendations</span>
            </h3>
            <div className="space-y-3">
              {insights.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Anomalies Detail */}
      {insights.anomalies.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span>Detected Anomalies ({insights.anomalies.length})</span>
          </h3>
          <div className="space-y-3">
            {insights.anomalies.map((anomaly, index) => (
              <div key={index} className={`p-4 rounded-lg border ${getSeverityColor(anomaly.severity)}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{anomaly.device} - {anomaly.parameter}</div>
                    <div className="text-sm mt-1">
                      Value: {formatPower(anomaly.value)} (Threshold: {formatPower(anomaly.threshold)})
                    </div>
                    <div className="text-xs mt-1">
                      {new Date(anomaly.timestamp).toLocaleString('th-TH')}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    anomaly.severity === 'high' 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {anomaly.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsights;

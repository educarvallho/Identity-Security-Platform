export type UserRole = "admin" | "operator" | "viewer";
export type RiskLevel = "low" | "medium" | "high";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface City {
  id: number;
  name: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskInfo {
  score: number;
  level: RiskLevel;
  reasons: string[];
}

export interface CurrentWeather {
  temperature: number;
  apparent_temperature: number;
  humidity: number;
  wind_speed_kmh: number;
  rain_probability: number;
  rain_volume_mm: number;
  weather_code: number;
  risk: RiskInfo;
}

export interface DailyForecast {
  date: string;
  max_temp: number;
  min_temp: number;
  rain_probability: number;
  rain_volume_mm: number;
  max_wind_speed_kmh: number;
  weather_code: number;
  risk: RiskInfo;
}

export interface CityForecast {
  city_id: number;
  city_name: string;
  state: string;
  current: CurrentWeather;
  daily: DailyForecast[];
}

export interface LocationWeather {
  latitude: number;
  longitude: number;
  nearest_city_name: string | null;
  current: CurrentWeather;
}

export interface CityRiskItem {
  city_id: number;
  city_name: string;
  state: string;
  temperature: number;
  rain_probability: number;
  wind_speed_kmh: number;
  risk_score: number;
  risk_level: RiskLevel;
  risk_reasons: string[];
}

export interface DashboardKPIs {
  total_cities: number;
  active_cities: number;
  avg_temperature: number;
  max_temperature: number;
  min_temperature: number;
  avg_rain_probability: number;
  high_risk_count: number;
  hottest_city: { id: number; name: string; temp: number } | null;
  coldest_city: { id: number; name: string; temp: number } | null;
  most_rain_prob_city: { id: number; name: string; prob: number } | null;
  most_rain_volume_city: { id: number; name: string; volume: number } | null;
  windiest_city: { id: number; name: string; wind: number } | null;
  best_operation_city: { id: number; name: string; risk_score: number } | null;
}

export interface Alert {
  city_id: number;
  city_name: string;
  risk_level: RiskLevel;
  risk_score: number;
  reasons: string[];
}

export interface Dashboard {
  kpis: DashboardKPIs;
  risk_ranking: CityRiskItem[];
  alerts: Alert[];
  temperature_comparison: { city_id: number; city_name: string; temperature: number }[];
  rain_comparison: { city_id: number; city_name: string; rain_probability: number; rain_volume_mm: number }[];
  last_updated: string;
}

export interface LocationForecast {
  latitude: number;
  longitude: number;
  nearest_city_name: string | null;
  current: CurrentWeather;
  daily: DailyForecast[];
}

export interface RiskRules {
  rain_prob_high: number;
  rain_prob_medium: number;
  wind_high: number;
  wind_medium: number;
  temp_extreme_high: number;
  temp_extreme_low: number;
  temp_high: number;
  temp_low: number;
  rain_volume_high: number;
  score_high_threshold: number;
  score_medium_threshold: number;
  updated_at?: string | null;
}

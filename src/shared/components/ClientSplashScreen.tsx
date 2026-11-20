import React from 'react';
import { AppSplashScreen } from './AppSplashScreen';

export const ClientSplashScreen: React.FC<{ durationMs?: number }> = ({ durationMs }) => (
  <AppSplashScreen appRole="client" minDurationMs={durationMs} />
);

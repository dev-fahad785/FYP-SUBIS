export const getBusId = (bus) => bus?.busId || bus?.id || '';

export const ROUTE_PALETTE = ['#3B82F6', '#F59E42', '#10B981', '#F43F5E', '#A78BFA', '#FBBF24', '#6366F1'];

export const getRouteColor = (index) => ROUTE_PALETTE[index % ROUTE_PALETTE.length];

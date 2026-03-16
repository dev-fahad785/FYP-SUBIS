// Realistic simulation data for Islamia University Bahawalpur (IUB)

export const IUB_ROUTES = [
  {
    id: 'ROUTE_RED',
    name: 'Red Line (Main Campus)',
    color: '#EF4444',
    stops: [
      { name: 'Main Gate', lat: 29.375, lng: 71.765 },
      { name: 'Admin Block', lat: 29.376, lng: 71.77 },
      { name: 'Central Library', lat: 29.377, lng: 71.773 },
      { name: 'Computer Science Dept', lat: 29.379, lng: 71.776 },
      { name: 'Cafeteria', lat: 29.38, lng: 71.772 },
      { name: 'Male Hostel', lat: 29.378, lng: 71.768 },
    ],
  },
  {
    id: 'ROUTE_BLUE',
    name: 'Blue Line (City Direct)',
    color: '#3B82F6',
    stops: [
      { name: 'City Terminal', lat: 29.395, lng: 71.68 },
      { name: 'Farid Gate', lat: 29.39, lng: 71.7 },
      { name: 'One Unit Chowk', lat: 29.385, lng: 71.73 },
      { name: 'IUB Main Gate', lat: 29.375, lng: 71.765 },
      { name: 'Engineering Dept', lat: 29.374, lng: 71.778 },
    ],
  },
];

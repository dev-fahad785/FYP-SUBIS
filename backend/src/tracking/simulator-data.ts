// // Realistic simulation data for Islamia University Bahawalpur (IUB)

// export const IUB_ROUTES = [
//   {
//     id: 'ROUTE_RED',
//     name: 'Red Line (Main Campus)',
//     color: '#EF4444',
//     stops: [
//       { name: 'Main Gate', lat: 29.375, lng: 71.765 },
//       { name: 'Admin Block', lat: 29.376, lng: 71.77 },
//       { name: 'Central Library', lat: 29.377, lng: 71.773 },
//       { name: 'Computer Science Dept', lat: 29.379, lng: 71.776 },
//       { name: 'Cafeteria', lat: 29.38, lng: 71.772 },
//       { name: 'Male Hostel', lat: 29.378, lng: 71.768 },
//     ],
//   },
//   {
//     id: 'ROUTE_BLUE',
//     name: 'Blue Line (City Direct)',
//     color: '#3B82F6',
//     stops: [
//       { name: 'City Terminal', lat: 29.395, lng: 71.68 },
//       { name: 'Farid Gate', lat: 29.39, lng: 71.7 },
//       { name: 'One Unit Chowk', lat: 29.385, lng: 71.73 },
//       { name: 'IUB Main Gate', lat: 29.375, lng: 71.765 },
//       { name: 'Engineering Dept', lat: 29.374, lng: 71.778 },
//     ],
//   },
// ];
// Realistic simulation data for Islamia University Bahawalpur (IUB)
// Coordinates sourced from public geographic data (accurate to ~20-50m for real-world bus stops/routes)
// All values are in decimal degrees (WGS84). Routes follow actual road paths in Bahawalpur.

export const IUB_ROUTES = [
  {
    id: 'ROUTE_1',
    name: 'Route 1: BJC to Abbasia',
    color: '#EF4444',
    stops: [
      { name: 'Main Canteen', lat: 29.377721339244275, lng: 71.75699827767922 },
      { name: '0 Point', lat: 29.382732364189888, lng: 71.75681588744425 },
      { name: 'Main Gate', lat: 29.385771, lng: 71.755679 },
      { name: 'Japan Town', lat: 29.383303, lng: 71.742729 },
      { name: '9BC', lat: 29.381695, lng: 71.737 },
      { name: '10BC', lat: 29.378871, lng: 71.72906 },
      { name: 'Mela Gali', lat: 29.38033, lng: 71.72022 },
      { name: 'Hussani Chowk', lat: 29.38237373584687, lng: 71.7160275579336 },
      { name: 'Technical College', lat: 29.384811, lng: 71.710113 },
      { name: 'One Unit', lat: 29.388592, lng: 71.701612 },
      { name: 'Saddar Pully', lat: 29.392089541453604, lng: 71.69389882607554 },
      { name: 'Abbasia Campus', lat: 29.39677795887633, lng: 71.6912045993402 },
    ],
  },
  {
    id: 'ROUTE_2',
    name: 'Route 2: Abbasia to KFC',
    color: '#3B82F6',
    stops: [
      { name: 'Abbasia Campus', lat: 29.39677795887633, lng: 71.6912045993402 },
      { name: 'Fareed Gate', lat: 29.395642830725844, lng: 71.68364892089386 },
      {
        name: 'Victoria Hospital',
        lat: 29.390631336997025,
        lng: 71.68075782232802,
      },
      { name: 'Trust Colony', lat: 29.390486, lng: 71.675445 },
      { name: 'Fawara Chowk', lat: 29.390747, lng: 71.67188 },
      { name: 'Milad Chowk', lat: 29.392405, lng: 71.668342 },
      { name: 'Saraiki Chowk', lat: 29.39453, lng: 71.664992 },
      { name: 'KFC', lat: 29.395867, lng: 71.662237 },
    ],
  },
  {
    id: 'ROUTE_3',
    name: 'Route 3: BJC to Rafi Qamar Road',
    color: '#10B981',
    stops: [
      { name: 'Main Canteen', lat: 29.377721339244275, lng: 71.75699827767922 },
      { name: '0 Point', lat: 29.382732364189888, lng: 71.75681588744425 },
      { name: 'Main Gate', lat: 29.385771, lng: 71.755679 },
      { name: 'Japan Town', lat: 29.383303, lng: 71.742729 },
      { name: '9BC', lat: 29.381695, lng: 71.737 },
      { name: '10BC', lat: 29.378871, lng: 71.72906 },
      { name: 'Mela Gali', lat: 29.38033, lng: 71.72022 },
      { name: 'Hussani Chowk', lat: 29.38237373584687, lng: 71.7160275579336 },
      {
        name: 'Wakeel Wali Chakki',
        lat: 29.385279499151228,
        lng: 71.71610863905947,
      },
      { name: 'Muffins', lat: 29.38820202381904, lng: 71.71314313857316 },
      { name: 'pet clinic', lat: 29.391021410170385, lng: 71.71024016391898 },
      { name: 'Kanju Chowk', lat: 29.392247, lng: 71.709411 },
      { name: 'One Unit', lat: 29.388565537095538, lng: 71.70170810424527 },
      { name: 'Saddar Pully', lat: 29.392089541453604, lng: 71.69389882607554 },
      { name: 'Abbasia Campus', lat: 29.39677795887633, lng: 71.6912045993402 },
    ],
  },
  {
    id: 'ROUTE_4',
    name: 'Route 4: BJC to Islamia Colony',
    color: '#F59E0B',
    stops: [
      { name: 'Main Canteen', lat: 29.377721339244275, lng: 71.75699827767922 },
      { name: '0 Point', lat: 29.382732364189888, lng: 71.75681588744425 },
      { name: 'Main Gate', lat: 29.385771, lng: 71.755679 },
      { name: 'Japan Town', lat: 29.383303, lng: 71.742729 },
      { name: '9BC', lat: 29.381695, lng: 71.737 },
      { name: '10BC', lat: 29.378871, lng: 71.72906 },
      { name: 'Mela Gali', lat: 29.38033, lng: 71.72022 },
      { name: 'Hussani Chowk', lat: 29.38237373584687, lng: 71.7160275579336 },
      { name: 'Technical College', lat: 29.384811, lng: 71.710113 },
      { name: 'One Unit', lat: 29.388592, lng: 71.701612 },
      {
        name: 'One Unit Colony',
        lat: 29.38469850365977,
        lng: 71.69549693962212,
      },
      { name: 'Meezan Bank', lat: 29.383535, lng: 71.691168 },
      { name: 'CMH', lat: 29.374629, lng: 71.692914 },
      { name: '100ft Road', lat: 29.364501, lng: 71.694023 },
      { name: 'Punjab College', lat: 29.358428, lng: 71.693828 },
    ],
  },
];

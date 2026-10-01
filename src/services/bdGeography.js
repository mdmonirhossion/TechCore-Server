export const bdDivisions = [
  'Dhaka',
  'Chittagong',
  'Rajshahi',
  'Khulna',
  'Barisal',
  'Sylhet',
  'Rangpur',
  'Mymensingh'
];

export const bdDistrictsMap = {
  'Dhaka': [
    'Dhaka', 'Gazipur', 'Narayanganj', 'Tangail', 'Faridpur', 
    'Manikganj', 'Munshiganj', 'Narsingdi', 'Madaripur', 'Rajbari', 
    'Shariatpur', 'Gopalganj', 'Kishoreganj'
  ],
  'Chittagong': [
    'Chittagong', 'Cox's Bazar', 'Comilla', 'Noakhali', 'Feni', 
    'Brahmanbaria', 'Chandpur', 'Rangamati', 'Bandarban', 'Khagrachhari', 'Lakshmipur'
  ],
  'Rajshahi': [
    'Rajshahi', 'Bogra', 'Pabna', 'Natore', 'Naogaon', 'Sirajganj', 'Joypurhat', 'Chapai Nawabganj'
  ],
  'Khulna': [
    'Khulna', 'Jessore', 'Kushtia', 'Satkhira', 'Bagerhat', 'Jhenaidah', 'Chuadanga', 'Meherpur', 'Magura', 'Narail'
  ],
  'Barisal': [
    'Barisal', 'Bhola', 'Patuakhali', 'Pirojpur', 'Barguna', 'Jhalokati'
  ],
  'Sylhet': [
    'Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'
  ],
  'Rangpur': [
    'Rangpur', 'Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Thakurgaon'
  ],
  'Mymensingh': [
    'Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'
  ]
};

export const bdUpazilasMap = {
  'Dhaka': ['Dhanmondi', 'Gulshan', 'Banani', 'Uttara', 'Mirpur', 'Mohammadpur', 'Badda', 'Motijheel', 'Savar', 'Keraniganj', 'Dohar'],
  'Gazipur': ['Gazipur Sadar', 'Kaliakair', 'Kapasia', 'Sreepur', 'Tongi'],
  'Narayanganj': ['Narayanganj Sadar', 'Araihazar', 'Bandar', 'Rupganj', 'Sonargaon'],
  'Chittagong': ['Kotwali', 'Panchlaish', 'Double Mooring', 'Halishahar', 'Agrabad', 'Hathazari', 'Sitakunda', 'Patiya'],
  'Bogra': ['Bogra Sadar', 'Shajahanpur', 'Sherpur', 'Dhunat', 'Gabtali'],
  'Rajshahi': ['Boalia', 'Rajpara', 'Paba', 'Godagari', 'Tanore']
};

export const allBdDistricts = Object.values(bdDistrictsMap).flat();


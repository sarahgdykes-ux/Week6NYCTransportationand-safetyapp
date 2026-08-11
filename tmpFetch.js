const url = 'https://data.cityofnewyork.us/resource/h9gi-nx95.json?$select=collision_id,crash_date,crash_time,borough,latitude,longitude,location,on_street_name,cross_street_name,number_of_persons_injured,number_of_persons_killed,contributing_factor_vehicle_1,contributing_factor_vehicle_2,contributing_factor_vehicle_3,contributing_factor_vehicle_4,contributing_factor_vehicle_5&$limit=5';

(async () => {
  try {
    const res = await fetch(url);
    console.log('status', res.status);
    const text = await res.text();
    console.log(text);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();

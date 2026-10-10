/* Складання всієї моделі */
function buildCar() {
  const car = new Car();
  buildFront(car, 'L'); buildFront(car, 'R');
  buildRear(car, 'L'); buildRear(car, 'R');
  buildFrontCentral(car);
  buildRearCentral(car);
  buildBody(car);
  return car;
}

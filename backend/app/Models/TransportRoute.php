<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransportRoute extends Model
{
    use HasFactory;

    protected $table = 'routes';

    protected $guarded = ['id'];

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function stops()
    {
        return $this->hasMany(RouteStop::class, 'route_id');
    }

    public function assignments()
    {
        return $this->hasMany(TransportAssignment::class, 'route_id');
    }
}

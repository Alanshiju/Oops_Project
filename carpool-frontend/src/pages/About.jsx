import React from "react";

const About = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-emerald-500 font-bold tracking-widest uppercase text-sm mb-2 block">
            Our Mission
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-900 mb-6 tracking-tight">
            Driving a Greener Campus.
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            CampusPool was born out of a simple idea: Jyothi Engineering College
            students shouldn't have to drive alone. We're building a connected
            community that shares the ride, splits the cost, and saves the
            planet.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-10 shadow-xl shadow-indigo-100 border border-slate-100 mb-12">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">
                Why we built this
              </h2>
              <p className="text-slate-600 mb-4 leading-relaxed">
                Every day, hundreds of cars commute to our campus, often with
                three or four empty seats. This leads to severe parking
                congestion, higher individual travel costs, and an unnecessarily
                massive carbon footprint.
              </p>
              <p className="text-slate-600 leading-relaxed">
                CampusPool provides a secure, exclusive platform tailored
                specifically for Jyothi students. By leveraging real-time
                spatial data and robust verification, we make sharing a ride as
                easy as tapping a button.
              </p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-100 text-center">
              <div className="text-5xl mb-4">🌍</div>
              <h3 className="text-xl font-bold text-emerald-800 mb-2">
                Our Goal
              </h3>
              <p className="text-emerald-700 font-medium">
                To reduce single-occupancy vehicles on our campus by 40% over
                the next academic year.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-100">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xl mx-auto mb-4">
              🤝
            </div>
            <h3 className="font-bold text-slate-800 mb-2">Community First</h3>
            <p className="text-sm text-slate-600">
              Exclusive to verified Jyothi students. Ride with classmates you
              can trust.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-100">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl mx-auto mb-4">
              🌱
            </div>
            <h3 className="font-bold text-slate-800 mb-2">Eco-Friendly</h3>
            <p className="text-sm text-slate-600">
              Fewer cars mean lower emissions. Track your personal CO₂ savings
              on your profile.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-100">
            <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-xl mx-auto mb-4">
              💰
            </div>
            <h3 className="font-bold text-slate-800 mb-2">Cost Effective</h3>
            <p className="text-sm text-slate-600">
              Split the fuel costs. Drivers earn back their gas money,
              passengers ride cheaper than transit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;

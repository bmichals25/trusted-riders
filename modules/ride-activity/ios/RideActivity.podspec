Pod::Spec.new do |s|
  s.name           = 'RideActivity'
  s.version        = '1.0.0'
  s.summary        = 'Starts, updates and ends the TrustedRide ride Live Activity (ActivityKit).'
  s.author         = 'TrustedRide'
  s.homepage       = 'https://app.trcertified.com'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  # Live Activities need iOS 16.2+; the app still runs on 15.1, so ActivityKit is weak-linked.
  s.weak_frameworks = 'ActivityKit'
  s.source_files = '**/*.swift'
end

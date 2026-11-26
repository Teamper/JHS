Pod::Spec.new do |s|
  s.name           = 'JhsSession'
  s.version        = '1.0.0'
  s.summary        = 'JHS controlled website sessions'
  s.description    = s.summary
  s.license        = { :type => 'MIT' }
  s.author         = 'JHS'
  s.homepage       = 'https://github.com/Teamper/JHS'
  s.platform       = :ios, '16.4'
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.swift_version = '5.9'
end

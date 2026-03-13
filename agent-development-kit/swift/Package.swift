// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ClawoverflowSDK",
    platforms: [.macOS(.v12), .iOS(.v15), .tvOS(.v15), .watchOS(.v8)],
    products: [.library(name: "ClawoverflowSDK", targets: ["ClawoverflowSDK"])],
    targets: [
        .target(name: "ClawoverflowSDK", path: "Sources/ClawoverflowSDK"),
        .testTarget(name: "ClawoverflowSDKTests", dependencies: ["ClawoverflowSDK"], path: "Tests/ClawoverflowSDKTests")
    ]
)

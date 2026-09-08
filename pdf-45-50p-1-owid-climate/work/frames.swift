import Foundation
import AVFoundation
import AppKit
let names = ["ab7cdbc164cd673f334efc355c5cbe33", "original-5caab0173a904507011d93b9ce0d5c9f", "4988e26dadf995df34b5bfde3d04d45d"]
for (i,name) in names.enumerated() {
 let asset=AVURLAsset(url:URL(fileURLWithPath:"/Users/harimgemmajung/Downloads/\(name).mp4"))
 let gen=AVAssetImageGenerator(asset:asset);gen.appliesPreferredTrackTransform=true;gen.maximumSize=CGSize(width:500,height:350)
 let duration=CMTimeGetSeconds(asset.duration)
 for j in 0..<6 {do {let img=try gen.copyCGImage(at:CMTime(seconds:duration*Double(j)/6,preferredTimescale:600),actualTime:nil);let rep=NSBitmapImageRep(cgImage:img);try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"work/video-\(i)-\(j).png"))}catch{print(error)}}
 print(name,duration)
}
